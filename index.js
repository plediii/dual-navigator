
// var log = require('./log');

var tryCtxtError = function (ctxt, message)  {
    try {
        ctxt.error(message);
    } catch (ok) {}
};

module.exports = function (Domain, libs) {
    var _ = libs._;
    var Promise = libs.Promise;
    Domain.prototype.navigator = function (window, options) {
        var d = this;
        options = _.defaults({}, options, {
            appOptions: { timeout: 0.01 }
            , appRoute: ['app']
            , indexRoute: ['index']
            , cleanPage: function () {}
            , globals: {}
        });
        
        var appRoute = options.appRoute;
        var indexRoute = options.indexRoute;
        var history = window.history;
        var appOptions = options.appOptions;
        var cleanPage = options.cleanPage;
        var globals = options.globals;

        var transition = Promise.resolve();
        var appLock = Promise.resolve();
        var closeApp = function () {
            return Promise.resolve();
        };

        var currentHash = function () {
            var locationhash = window.location.hash;
            var hash = locationhash && locationhash.slice(1) || '';
            return hash;
        };

        d.mount(['navigate', '::subroute'], function (body, ctxt) {
            var subroute = ctxt.params.subroute;
            var newHash = subroute.join('/');
            if (currentHash() !== newHash) {
                history.pushState(null, null, window.location.pathname + '#' + newHash);
            }
            var thisLock = appLock = appLock
                .then(function () {
                    return d.request(appRoute.concat(ctxt.params.subroute), globals, appOptions);
                })
                .spread(function (body, options) {
                    if (appLock !== thisLock) {
                        // a new navigation event occured before we could load the app
                        return;
                    }
                    if (options.statusCode == 200) {
                        var app = body;
                        if (!_.isFunction(app)) {
                            ctxt.error('App request did not return a start function.');
                            return;
                        }
                        return Promise.resolve(closeApp())
                            .then(function () {
                                closeApp = function () {}; // prevent reclosure
                                cleanPage();
                                if (appLock !== thisLock) {
                                    // a new navigation event occured before we could load the app
                                    return;
                                }
                                closeApp = app();
                                if (!_.isFunction(closeApp)) {
                                    closeApp = function () {
                                        return Promise.resolve();
                                    };
                                };
                            });
                    }
                    else if (options.statusCode == 301
                             || options.statusCode == 503) {
                        var redirectRoute;
                        if (options.statusCode == 301) {
                            redirectRoute = body;
                        }
                        else if (!_.isEqual(subroute, indexRoute)) {
                            redirectRoute = indexRoute;
                        }
                        else {
                            return ctxt.error('Index route is not available');
                        }
                        if (!_.isArray(redirectRoute)) {
                            ctxt.error('Invalid redirect route: ' + typeof redirectRoute);
                            return;
                        }
                        window.history.replaceState(null, null, '#' + redirectRoute.join('/'));
                        return d.send(['navigate'].concat(redirectRoute), []);
                    }
                    else {
                        var message = '' + options.statusCode + ' : ' + body;
                        tryCtxtError(ctxt, message);
                        d.request(['app', 'error'], _.extend({}, globals, { error: message }), { timeout: 0.1 })
                            .spread(function (body, options) {
                                if (options.statusCode == 200) {
                                    var errapp = body;
                                    if (!_.isFunction(errapp)) {
                                        ctxt.send(['error', 'app', 'error'], [], 'Error app request did not return a start function.');
                                        return;
                                    }
                                    return Promise.resolve(closeApp())
                                        .then(function () {
                                            cleanPage();
                                            closeApp = errapp();
                                            if (!_.isFunction(closeApp)) {
                                                closeApp = function () {
                                                    return Promise.resolve();
                                                };
                                            };
                                        });
                                }
                                else if (options.statusCode == 503) {
                                    console.error('No application error handler.');
                                }
                                else {
                                    console.error(message);
                                    ctxt.send(['error', 'app', 'error'], [], '' + options.statusCode + ' Bad error application response ' +  body);
                                    return;
                                }
                            });
                    }
                });
        });

        var go = function () {
            var hash = currentHash();
            if (hash.length === 0) {
                d.send(['navigate'].concat(indexRoute), []);
            } else {
                d.send(['navigate'].concat(currentHash().split('/')), []);
            }
        };

        return {
            start: function () {
                window.addEventListener('hashchange', function (e) {
                    go();
                });
                go();
            }
        };
    };
};
