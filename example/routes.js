"use strict";

var Promise = require('bluebird');

module.exports = {
    index: function (body, ctxt) {
        ctxt.return(function () {
            var appNode = document.getElementsByClassName('app')[0];
            appNode.innerText = "This is the index page.";
            appNode.classList.add('index');
        });
    }
    , document: {
        '::documentRoute': function (body, ctxt) {
            ctxt.return(function () {
                var appNode = document.getElementsByClassName('app')[0];
                appNode.innerText = "You are now looking at the document " + ctxt.params.documentRoute.join('/');
                appNode.classList.add('document');
            });
        }
    }
    , stateful: {
        '::documentRoute': function (body, ctxt) {
            ctxt.return(function () {
                var appNode = document.getElementsByClassName('app')[0];
                var documentName = ctxt.params.documentRoute.join('/');
                appNode.innerText = "You are now looking at the STATEFUL document " + documentName + ".  Asynchronous tear down will occur before transition to the next state";
                appNode.classList.add('document');
                // when the user navigates away... dual-navigator
                // will wait for the promise returned by the
                // following function to resolve before continuing
                return function () {
                    return new Promise(function (resolve) {
                        console.log('cleaning up...');
                        appNode.innerText = "I'm pretending to CLEAN up the STATE before letting you navigate away from " + documentName +"...";
                        appNode.classList.add('cleaning');
                        setTimeout(function () {
                            console.log('Done cleaning...');
                            resolve();
                        }, 1000);
                    });
                };
            });
        }
    }
    , redirect: {
        '::redirectTo': function (body, ctxt) {
            // if we return with a status code of 301, dual navigator
            // will interpret the body as a route to which to
            // redirect.  The redirect route will be removed from the
            // window history.
            ctxt.return(ctxt.params.redirectTo, { statusCode: 301 });
        }
    }
    , throw: {
        '::throwRoute': function (body, ctxt) {
            throw new Error(ctxt.params.throwRoute.join('/'));
        }
    }
    , bad: {
        route: function (body, ctxt) {
            ctxt.return("This is not valid", { statusCode: 999 });
        }
    }
    , error: function (body, ctxt) {
        ctxt.return(function () {
            var appNode = document.getElementsByClassName('app')[0];
            appNode.innerText = "Oops, that's an error: " + body.error;
            appNode.classList.add('error');
        });
    }
};
