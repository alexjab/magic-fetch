[![CircleCI](https://circleci.com/gh/alexjab/magic-fetch.svg?style=svg)](https://circleci.com/gh/alexjab/magic-fetch)
[![Test Coverage](https://codeclimate.com/github/alexjab/magic-fetch/badges/coverage.svg)](https://codeclimate.com/github/alexjab/magic-fetch/coverage)

# magic-fetch

### About
`magic-fetch` is a wrapper around `fetch`. Its purpose is to give you greater control over
your HTTP requests.

`magic-fetch` works as a queue. You push your requests, and they get sent over HTTP using
fetch. If you `push` a query while one is already being processed, the second one will be
queued, then sent when the first one finishes and so on.

When creating a queue, you need to pass an instance of `fetch`.

### Table of content
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [TL;DR](#tldr)
- [Create a queue](#create-a-queue)
- [Method helpers](#method-helpers)
- [Events](#events)
- [Middleware](#middleware)
  - [Request middleware](#request-middleware)
  - [Response middleware](#response-middleware)
  - [Error middleware](#error-middleware)
  - [Queue handler](#queue-handler)
  - [Connect middleware](#connect-middleware)
  - [Combine middleware](#combine-middleware)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### TL;DR

```
const { createQueue } = require('magic-fetch');

const queue = createQueue(fetch);

queue.push({
  url: host + '/'
})
.catch(err => ...)
.then(res => ...);
```

The only difference with fetch is that you put the `url` field in the parameters of `push`.
You can also add any number of custom fields, they will just be ignored when passed to `fetch`,
but will be visible from your [request middleware](#request-middleware).

Parameters:

 - `url` - The url (specific to `magic-fetch`)
 - `method` (String) - HTTP request method. Default: `"GET"`
 - `body` (String, body types) - HTTP request body
 - `headers` (Object, Headers) - Default: `{}`
 - `credentials` (String) - Authentication credentials mode.

See [https://github.github.io/fetch/](https://github.github.io/fetch/) for more information.

### Create a queue

```
const queue = createQueue(fetch);
```

### Method helpers
| `method` | Queue function.    |
| -------- | ------------------ |
| `GET`    | `queue.get(...)`   |
| `POST`   | `queue.post(...)`  |
| `PUT`    | `queue.put(...)`   |
| `PATCH`  | `queue.patch(...)` |
| `DELETE` | `queue.del(...)`   |
| `HEAD`   | `queue.head(...)`  |

### Events

To listen to queue events, just use the `on` method:

```
queue.on('unhandledError', (err) => ...);
```

 - `unhandledError`: emitted when your request / response / error middleware throws an error.

### Middleware
There are four sorts of middleware that you can add to your queues in order to extend their features. For example, you may add a middleware that will add headers for authentication.

#### Request middleware

```
requestMiddleware(request)
```

Request middleware are functions that take a raw query as parameter, and that will be called right before your query is sent. Request middleware
**MUST** return a valid query object. If you want to ignore a query, just return `null`.

```
function requestMiddleware(request) {
  // Do stuff
  return request;
}
```

Parameters:

 - `request`: the request as you passed it to `push`


#### Response middleware

```
responseMiddleware(response, request)
```

Response middleware are functions that take a response from an HTTP request, and that will be called with the HTTP response. Response middleware can return whatever you want, it won't be used by any other function (unless you combine several layers of middleware).

```
function responseMiddleware(response, request) {
  // Do stuff
  return response;
}
```

Parameters:

 - `response`: the HTTP response of your request,
 - `request`: the query that came from your request middleware.

#### Error middleware

```
errorMiddleware(error, request)
```

Error middleware are like response middleware but for errors.

```
function errorMiddleware(error, request) {
  // Do stuff
  return error;
}
```

Parameters:

 - `error`: the HTTP error if your request ends up in error,
 - `request`: the request that came from your request middleware.

#### Queue handler

```
queueHandler(error, response, request)
```

Queue handler is a special function that will give you control over the way your queue processes queries:

 - if you want to pause the processing of the queue, you can return a `Promise` (which you resolve whenver you want),
 - if you want to nack your query (that is, not removing it from the queue, but *replay* it instead), you can `throw` an error or return a `Promise.reject()`.

Be careful when using both of these options because they can freeze your queue or make it **process the same request over and over again** (especially if your code unintentionally crashes).

```
function queueHandler(error, response, request) {
  // Do stuff
  return Promise.resolve();
}
```

Parameters:

 - `error`: the HTTP error (if any),
 - `response`: the HTTP response (if any),
 - `request`: the request that came from your request middleware.

#### Connect middleware

```
connectMiddleware([requestMiddleware], [responseMiddleware], [errorMiddleware], [queueHandler])
```

To connect these middleware to your queue, your need to use `connectMiddleware`:

```
const { createQueue, connectMiddleware } = require('magic-fetch');

const createDefaultQueue = connectMiddleware(requestMiddleware,
                                             responseMiddleware,
                                             errorMiddleware,
                                             queueHandler)(createQueue);
const queue = createDefaultQueue(fetch);
```

If you want not to provide a middleware, just pass `null`. Example:

```
const createDefaultQueue = connectMiddleware(null, null, null, queueHandler)(createQueue);
```

#### Combine middleware

```
const middleware = combineMiddleware(...functions);
```

If you would like to split your middleware into smaller functions, you can do so and then combine them using `combineMiddleware`. Works only on request, response and error middleware, **NOT** queue handler.

Example:

```
function loggerMiddleware(request) {
  console.log(`${request.method} - ${request.url}`);
  return request;
}
function authMiddleware(request) {
  request.headers['Authorization'] = `Bearer ${token}`;
  return request;
}
function jsonMiddleware(request) {
  request.text = JSON.stringify(request.body);
  request.headers['Content-Type'] = 'application/json';
  request.headers['Accept'] = 'application/json';
  return request;
}

const requestMiddleware = combineMiddleware(loggerMiddleware, authMiddleware, jsonMiddleware);
```

### License

MIT

