/*jslint node: true */
"use strict";

var assert = require('assert');
var _ = require('lodash');
var Promise = require('bluebird');

var mockWindow = require('./mock-window');

var dualapi = require('dualapi')
.use(require('../index'));

describe('navgiator', function () {

    var window, dual, n;
    beforeEach(function () {
        dual = dualapi();
        dual.mount(['error'], function () {});
        window = mockWindow('somepage#start');
    });

    describe('smoke test', function () {
        it('should be exposed on domain', function () {
            assert(_.isFunction(dual.navigator));
        });

        it('should expose start api', function () {
            var n = dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            });
            assert(_.isFunction(n.start));
        });
    });

    describe('location hash', function () {

        it('should navigate to the index if no route on start', function (done) {
            window.history.pushState(null, null, 'somepage');
            dual.once(['app', 'index'], function (msg) {
                done();
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });


        it('should navigate to the target app state on start', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.once(['app', 'navigate', 'here'], function (msg) {
                done();
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should induce app state change when changed', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.mount(['app', 'navigate', 'here'], function () {});
            dual.once(['app', 'then', 'navigate', 'there'], function () {
                done();
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            window.location.hash = 'then/navigate/there';
        });
    });

    describe('application state', function () {

        it('should start start at the current hash', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    done();
                    return function () {
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should send an error event if start response is not a function', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.once(['error', 'navigate', 'navigate', 'here'], function (body, ctxt) {
                done();
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return('else');
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should *not* be closed before requesting the next state', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var firstStateClosed = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {
                        firstStateClosed = true;
                    };
                });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                assert(!firstStateClosed);
                done();
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            window.location.hash = 'then/navigate/there';
        });

        it('should be closed before starting the next state', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var firstStateClosed = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                return ctxt.return(function () {
                    window.location.hash = 'then/navigate/there';
                    return function () {
                        firstStateClosed = true;
                    };
                });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                return ctxt.return(function () {
                    assert(firstStateClosed);
                    done();
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , appOptions: {
                    timeout: 1
                }
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should be interpreted as already closed if no close function', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var firstState = {};
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {});
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                return ctxt.return(function () {
                    done();
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            window.location.hash = 'then/navigate/there';
        });

        it('should be interpreted as synchronous if close function does not return promise', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var firstState = {};
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {};
                });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                return ctxt.return(function () {
                    done();
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            window.location.hash = 'then/navigate/there';
        });

        it('should be closed after receiving the next state', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var secondStateReplied = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                return ctxt.return(function () {
                    window.location.hash = 'then/navigate/there';
                    return function () {
                        assert(secondStateReplied);
                        done();
                        return Promise.resolve();
                    };
                }, { statusCode: 200 });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {});
                secondStateReplied = true
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should be closed before running the next state', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var secondStateRun = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                return ctxt.return(function () {
                    window.location.hash = 'then/navigate/there';
                    return function () {
                        assert(!secondStateRun);
                        done();
                        return Promise.resolve();
                    };
                }, { statusCode: 200 });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                return ctxt.return(function () {
                    secondStateRun = true;
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should be run after resolving first state closure', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var firstStateCloseResolved = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                return ctxt.return(function () {
                    window.location.hash = 'then/navigate/there';
                    return function () {
                        return new Promise(function (resolve) {
                            firstStateCloseResolved = true;
                            resolve();
                        });
                    };
                }, { statusCode: 200 });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                return ctxt.return(function () {
                    assert(firstStateCloseResolved);
                    done();
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });        
    });

    describe('page clean', function () {

        it('should happen before app start', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var cleaned = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    assert(cleaned);
                    done();
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
                , cleanPage: function () {
                    cleaned = true;
                }
            }).start();
        });

        it('should happen before starting the next state', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var firstStateRun = false;
            var cleaned = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    firstStateRun = true;
                    window.location.hash = 'then/navigate/there';
                });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    assert(cleaned);
                    done();
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
                , cleanPage: function () {
                    if (firstStateRun) {
                        cleaned = true;
                    }
                }
            }).start();
            dual.once(['app'])
        });        

        it('should happen after closing first state', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var firstStateRun = false;
            var firstStateClosed = false;
            var cleaned = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    window.location.hash = 'then/navigate/there';
                    firstStateRun = true;
                    return function () {
                        firstStateClosed = true;
                    };
                });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    assert(cleaned);
                    done();
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
                , cleanPage: function () {
                    if (firstStateRun) {
                        assert(firstStateClosed);
                        cleaned = true;
                    }
                }
            }).start();
            dual.once(['app'])
        });

        it('should happen after resolving first state close', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var firstStateRun = false;
            var firstStateCloseResolved = false;
            var cleaned = false;
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    window.location.hash = 'then/navigate/there';
                    firstStateRun = true;
                    return function () {
                        return new Promise(function (resolve) {
                            firstStateCloseResolved = true;
                            resolve();
                        });
                    };
                });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    assert(cleaned);
                    done();
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
                , cleanPage: function () {
                    if (firstStateRun) {
                        assert(firstStateCloseResolved);
                        cleaned = true;
                    }
                }
            }).start();
            dual.once(['app'])
        });
    });

    describe('navigation events', function () {

        it('should induce app state fetch', function (done) {
            dual.mount(['app', 'start'], function () {});
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                done();
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            dual.send(['navigate', 'navigate', 'here']);
        });

        it('should induce hash change on window', function (done) {
            dual.mount(['app', 'start'], function () {});
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                assert.equal(window.location.hash, '#navigate/here');
                done();
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            dual.send(['navigate', 'navigate', 'here']);
        });

        it('should not load application if new navigation before load', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.mount(['app', 'navigate', 'there'], function (body, ctxt) {
                done();
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                dual.send(['navigate', 'navigate', 'there']);
                ctxt.return(function () {
                    done('should not have loaded');
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should not load application if new navigation before previous close completes', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.mount(['app', 'navigate', 'here', 'finally'], function (body, ctxt) {
                done();
            });
            dual.mount(['app', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    done('should not have loaded this app');
                });
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    dual.send(['navigate', 'navigate', 'there']);
                    return function () {
                        dual.send(['navigate', 'navigate', 'here', 'finally']);
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should still clean page even if new navigation before previous close completes', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var cleaned = false;
            var firstAppLoaded = false;
            dual.mount(['app', 'navigate', 'here', 'finally'], function (body, ctxt) {
                assert(cleaned);
                done();
            });
            dual.mount(['app', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    done('should not have loaded this app');
                });
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    firstAppLoaded = true;
                    dual.send(['navigate', 'navigate', 'there']);
                    return function () {
                        dual.send(['navigate', 'navigate', 'here', 'finally']);
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
                , cleanPage: function () {
                    if (firstAppLoaded) {
                        cleaned = true;
                    }
                }
            }).start();
        });

        it('should not load application if new navigation before previous close resolves', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.mount(['app', 'navigate', 'here', 'finally'], function (body, ctxt) {
                done();
            });
            dual.mount(['app', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    done('should not have loaded this app');
                });
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    dual.send(['navigate', 'navigate', 'there']);
                    return function () {
                        return new Promise(function (resolve, reject) {
                            dual.send(['navigate', 'navigate', 'here', 'finally']);
                            resolve();
                        });
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should not reclose first app if navigation before previous close resolves', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var cleaned = false;
            var firstAppClosed = false;
            dual.mount(['app', 'navigate', 'here', 'finally'], function (body, ctxt) {
                assert(firstAppClosed);
                ctxt.return(function () {});
                done();
            });
            dual.mount(['app', 'navigate', 'then', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    dual.send(['navigate', 'navigate', 'here', 'finally']);
                    assert(firstAppClosed);
                });
            });
            dual.mount(['app', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    done('should not have loaded this app');
                });
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(function () {
                    dual.send(['navigate', 'navigate', 'there']);
                    return function () {
                        assert(!firstAppClosed);
                        firstAppClosed = true;
                        return new Promise(function (resolve) {
                            dual.send(['navigate', 'navigate', 'then', 'here']);
                            resolve();
                        });
                    };
                }, { statusCode: 200 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
                , cleanPage: function () {
                }
            }).start();
        });
    });

    describe('redirect status code', function () {

        it('should induce navigation to the redirect route', function (done) {
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(['redirect', 'there'], { statusCode: 301 });
            });
            dual.once(['app', 'redirect', 'there'], function () {
                done();
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {};
                });
            });
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            dual.send(['navigate', 'navigate', 'here']);
        });

        it('should raise error on invalid redirect route', function (done) {
            dual.mount(['error', 'navigate', 'navigate', 'here'], function (body) {
                done();
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return({ no: 'good' }, { statusCode: 301 });
            });
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should remove the location from history', function (done) {
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {};
                });
            });
            dual.mount(['app', 'start'], function () {
                done();
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(['redirect', 'there'], { statusCode: 301 });
            });
            dual.mount(['app', 'redirect', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                });
                window.history.back();
            });
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should *not* remove the location from history if new request before received', function (done) {
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {};
                });
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                setTimeout(function () {
                    ctxt.return(['redirect', 'there'], { statusCode: 301 });
                }, 10);
            });
            dual.mount(['app', 'redirect', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                });
            });
            dual.mount(['app', 'agent'], function () {
                assert.equal(window.location.hash, '#agent');
                done();
            });
            window.history.pushState(null, null, 'somepage#navigate/here');
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            window.location.hash = 'agent';
        });

    });

    describe('error status code', function () {

        it('should redirect to error app state', function (done) {
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('error', { statusCode: 403 });
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                done();
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should send error on invalid error app', function (done) {
            dual.mount(['error', 'app', 'error'], function () {
                done();
            });
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 403 });
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return({ not: 'function ' });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should send error on invalid error app status code', function (done) {
            dual.mount(['error', 'app', 'error'], function () {
                done();
            });
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 403 });
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {}, { statusCode: 999 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should not freeze navigation when there is no eror handler', function (done) {
            dual = dualapi(); // make a new domain without error handler
            dual.mount(['error', 'app', 'error'], function () {
                done();
            });
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 403 });
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {}, { statusCode: 999 });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should execute error app', function (done) {
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 403 });
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {
                    done();
                    return function () {
                        return Promise.resolve();
                    };
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should have default no op for error app cleanup', function (done) {
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 403 });
            });
            dual.mount(['app', 'safeplace'], function (body, ctxt) {
                ctxt.return(function () {});
                done();
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {
                    ctxt.send(['navigate', 'safeplace'])
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should redirect to error app state with error message', function (done) {
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 403 });
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                assert(ctxt.body.hasOwnProperty('error'));
                done();
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should emit an error', function (done) {
            dual.mount(['error'], function () {
                done();
            });
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 403 });
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

    });

    describe('index route', function () {

        it('should be reached for any unavailable page', function (done) {
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 503 });
            });
            dual.mount(['app', 'index'], function () {
                done();
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should redirect to index when initial state has no hash', function (done) {
            window = mockWindow('somepage');
            dual.once(['app', 'index'], function () {
                done();
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });

        it('should not enter recursive loop when there is app index is not accessible', function (done) {
            window = mockWindow('somepage');
            dual.mount(['error'], function () {
                done();
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
        });
    });

    describe('globals', function () {
        
        it('should be broadcast as body with each app request', function (done) {
            dual.mount(['app', 'start'], function (body, ctxt) {
                assert.equal(ctxt.body.black, 'hole');
                done();
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                ctxt.return(function () {
                    return function () {};
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {
                    black: 'hole'
                }
            }).start();
        });

        it('should be broadcast as body with error app request', function (done) {
            dual.mount(['app', 'index'], function () {});
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: 403 });
            });
            dual.mount(['app', 'error'], function (body, ctxt) {
                assert.equal(ctxt.body.kindof, 'alot');
                done();
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {
                    kindof: 'alot'
                }
            }).start();
        });

    });

    describe('app request options', function () {

        it('should be overridable for timeout = 100', function (done) {
            var start = Date.now();
            dual.mount(['app', 'index'], function () {});
            dual.mount(['app', 'error'], function (body, ctxt) {
                var delta = Date.now() - start;
                assert(delta >= 100);
                assert(delta < 200);
                done();
                ctxt.return(function () {
                    return function () {};
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , appOptions: {
                    timeout: 0.100
                }
            }).start();
        });

        it('should be overridable for timeout = 200', function (done) {
            var start = Date.now();
            dual.mount(['app', 'index'], function () {});
            dual.mount(['app', 'error'], function (body, ctxt) {
                var delta = Date.now() - start;
                assert(delta >= 200);
                assert(delta < 300);
                done();
                ctxt.return(function () {
                    return function () {};
                });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , appOptions: {
                    timeout: 0.2
                }
            }).start();
        });
    });

});
