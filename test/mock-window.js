/*jslint node: true */
"use strict";

var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;

var parseLocation = function (current, url) {
    var hashidx = url.indexOf('#');
    var pathname;
    var hash;
    if (hashidx > 0) {
        pathname = url.slice(0, hashidx);
        hash = url.slice(hashidx);
    }
    else if (hashidx === 0) {
        pathname = current.pathname;
        hash = url;
    }
    else {
        pathname = url;
        hash = '';
    }
    return {
        pathname: pathname
        , hash: hash
    };
};

var locationToUrl = function (location) {
    return location.pathname + location.hash;
};

module.exports = function (startURL) {
    if (!_.isString(startURL)) {
        throw new Error('No start URL provided to mock window');
    }
    var events = new EventEmitter();
    var history = [];
    var _this = {
        history: {
            pushState: function (state, title, url) {
                var location;
                try {
                    location = parseLocation(history[history.length - 1], url);
                }
                catch (e) {
                    console.error('Could not parse pushstate url: ', url, e);
                    throw e;
                }
                history.push(location);
                setLocation(location);
            }
            , replaceState: function (state, title, url) {
                var location = parseLocation(history.pop(), url);
                history.push(location);
                setLocation(location);
            }
            , back: function () {
                var current = history.pop();
                var back = history[history.length - 1];
                setLocation(back, locationToUrl(back));
                if (back.hash !== current.hash) {
                    events.emit('hashchange');
                }
            }
        }
        , location: {}
        , addEventListener: function (name, f) {
            events.on(name, f);
        }
    };
    var setLocation = function (location) {
        var locationObj = { _pathname: location.pathname
                            , _hash: location.hash
                          };
        Object.defineProperties(locationObj, {
            pathname: {
                set: function (v) {
                    var newLocation = parseLocation(history[history.length - 1], v);
                    history.push(newLocation);
                    setLocation(newLocation);
                }
                , get: function () {
                    return locationObj._pathname;
                }
            }
            , hash: {
                set: function (v) {
                    if (v[0] === '#') {
                        v = v.slice(1);
                    }
                    process.nextTick(function () {
                        var newLocation = parseLocation(history[history.length - 1], '#' + v);
                        history.push(newLocation);
                        setLocation(newLocation);
                        events.emit('hashchange');
                    });
                }
                , get: function () {
                    return locationObj._hash;
                }
            }
        });
        _this.location = locationObj;
    };

    var startLocation = parseLocation({pathname: '', hash: ''}, startURL);
    history.push(startLocation);
    setLocation(startLocation);
    
    return _this;
};
