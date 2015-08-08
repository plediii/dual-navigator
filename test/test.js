/*jslint node: true */
"use strict";

var assert = require('assert');
var _ = require('lodash');
var Promise = require('bluebird');

var mockWindow = require('./mock-window');

var dualapi = require('dualapi')
.use(require('../index'));

var mockApp = function (state) {
    state = state || {};
    return function (body, ctxt) {
        state.called = true;
        setTimeout(function () {
            state.replied = true;
            ctxt.return(function () {
                state.run = true;
                return function () {
                    state.closed = true;
                    return Promise.resolve();
                };
            }, { statusCode: '200' });
        }, 1);
    };
};

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
            dual.mount(['app', 'navigate', 'here'], mockApp());
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
                }, { statusCode: '200' });
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
            var firstState = {};
            dual.mount(['app', 'navigate', 'here'], mockApp(firstState));
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                assert(!firstState.closed);
                done();
                ctxt.return(function () {
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: '200' });
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
            var firstState = {};
            dual.mount(['app', 'navigate', 'here'], mockApp(firstState));
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                return ctxt.return(function () {
                    assert(firstState.closed);
                    done();
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: '200' });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , appOptions: {
                    timeout: 1
                }
                , indexRoute: ['index']
                , globals: {}
            }).start();
            window.location.hash = 'then/navigate/there';
        });

        it('should be interpreted as synchronous closure if not close function', function (done) {
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
                }, { statusCode: '200' });
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
                }, { statusCode: '200' });
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
            var secondState = {};
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                return ctxt.return(function () {
                    return function () {
                        assert(secondState.replied);
                        done();
                        return Promise.resolve();
                    };
                }, { statusCode: '200' });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], mockApp(secondState));
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            window.location.hash = 'then/navigate/there';
        });

        it('should be closed before running the next state', function (done) {
            window.history.pushState(null, null, 'somepage#navigate/here');
            var secondState = {};
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                return ctxt.return(function () {
                    return function () {
                        assert(!secondState.run);
                        done();
                        return Promise.resolve();
                    };
                }, { statusCode: '200' });
            });
            dual.mount(['app', 'then', 'navigate', 'there'], mockApp(secondState));
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
            }).start();
            window.location.hash = 'then/navigate/there';
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
                }, { statusCode: '200' });
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
            var firstState = {};
            var cleaned = false;
            dual.mount(['app', 'navigate', 'here'], mockApp(firstState));
            dual.mount(['app', 'then', 'navigate', 'there'], function (body, ctxt) {
                ctxt.return(function () {
                    assert(cleaned);
                    done();
                    return function () {
                        return Promise.resolve();
                    };
                }, { statusCode: '200' });
            });
            dual.navigator(window, {
                appRoute: ['app']
                , indexRoute: ['index']
                , globals: {}
                , cleanPage: function () {
                    if (firstState.run) {
                        cleaned = true;
                    }
                }
            }).start();
            dual.once(['app'])
            window.location.hash = 'then/navigate/there';
        });        
    });

    describe('navigation events', function () {

        it('should induce app state fetch', function (done) {
            dual.mount(['app', 'start'], mockApp());
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
            dual.mount(['app', 'start'], mockApp());
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
    });

    describe('redirect status code', function () {

        it('should induce navigation to the redirect route', function (done) {
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return(['redirect', 'there'], { statusCode: '301' });
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
                console.log('error ', body);
                done();
            });
            dual.mount(['app', 'navigate', 'here'], function (body, ctxt) {
                ctxt.return({ no: 'good' }, { statusCode: '301' });
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
                ctxt.return(['redirect', 'there'], { statusCode: '301' });
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
                    ctxt.return(['redirect', 'there'], { statusCode: '301' });
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
                ctxt.return('error', { statusCode: '403' });
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

        it('should execute error app', function (done) {
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: '403' });
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

        it('should redirect to error app state with error message', function (done) {
            dual.mount(['app', 'start'], function (body, ctxt) {
                ctxt.return('erro', { statusCode: '403' });
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
                ctxt.return('erro', { statusCode: '403' });
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
                ctxt.return('erro', { statusCode: '503' });
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
                ctxt.return('erro', { statusCode: '403' });
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
