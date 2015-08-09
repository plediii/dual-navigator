
var dualapi = require('dualapi').use(require('../index'));
var domain = dualapi();
var Promise = require('bluebird');

domain.mount(['**'], function (body, ctxt) {
    console.log(ctxt.from.join('/'), ' -> ', ctxt.to.join('/'));
});

domain.mount({
    app: require('./routes')
});

var n = domain.navigator(window, {
    appRoute: ['app']
    , indexRoute: ['index']
    , globals: {}
    , cleanPage: function () {
        var currentApp = document.getElementsByClassName('app')[0];
        var newApp = document.createElement('div');
        newApp.classList.add('app');
        currentApp.parentNode.insertBefore(newApp, currentApp);
        currentApp.parentNode.removeChild(currentApp);
    }
});

n.start();
