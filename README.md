# dual-navigator [![Build Status](http://jenkins.plediii.net:8080/buildStatus/icon?job=dual-navigator master)](http://jenkins.plediii.net:8080/job/dual-navigator%20master/)

[dualapi](https://github.com/plediii/dualapi) domains are already like
a network of distributed HTTP servers extending into the browser.
`dual-navigator` furthers this pattern by using the the
`window.location` hash to route into a `dualapi` domain.  

A live example is mounted at
[http://plediii.github.io/dual-navigator/example/index.html](http://plediii.github.io/dual-navigator/example/index.html),
for the routes at
[https://github.com/plediii/dual-navigator/blob/master/example/routes.js](https://github.com/plediii/dual-navigator/blob/master/example/routes.js).

## Using `dual-navigator` with `dualapi`

To use `dual-navigator`, first extend `dualapi` with the `dual-navigator` module:

```javascript
var dualapi = require('dualapi').use(require('dual-navigator'));
```

Then once you've instantiated a `dualapi` domain,
```javascript
var domain = dualapi();
```

you can create a navigator instance:
```javascript
domain.navigator(window, {
    appRoute: ['app']
    , indexRoute: ['index']
    , globals: {}
    , cleanPage: function () {}
})
```

The declaration that states that:
* The application routes can be reached on the domain below the `['app']` route.  
* If no route is provided, it will default to `['app', 'index']`.
* Between application states, the `cleanpage` function will be called (in this case a no-op)

## Creating application routes

`dual-navigator` application routes are hosts which return functions
to be called when the browser navigates to a window location with the
same hash as the route:

```javascript
domain.mount([app', 'index'], function (body, ctxt) {
   ctxt.return(function () {
     // render index application
   });
});
```

The application may optionally return a cleanup function, to be called
before the next route is loaded.
```javascript
domain.mount(['app', 'withcleanup'], function (body, ctxt) {
   ctxt.return(function () {
     // render index application
      return function () {
        // cleanup logic
      };
   });
});
```

The cleanup function may optionally return a `Promise` to be resolved
before continuing loading the next application.  Finally, the optional
`cleanup` function provided during navigator instantiation will be
called, regardless of whether the app has its own cleanup function.

The normal navigator flow is as follows:

1. User navigates to a hash
2. Navigator requests application
3. Navigator calls previous application cleanup
4. When the application cleanup resolves, navigator's `cleanup`
5. When the cleanup complete, navigator calls the new application

See the [example routes](https://github.com/plediii/dual-navigator/blob/master/example/routes.js).
