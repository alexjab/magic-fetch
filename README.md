# magic-fetch

### About
`magic-fetch` is a wrapper around `fetch`. Its purpose is to give you greater control over
your HTTP queries.

`magic-fetch` works as a queue. You push your queries, and they get sent over HTTP using
fetch. If you `push` a query while one is already being processed, the second one will be
queued, then sent when the first one finishes and so on.

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

Parameters:

 - `url` - The url (specific to `magic-fetch`)
 - `method` (String) - HTTP request method. Default: `"GET"`
 - `body` (String, body types) - HTTP request body
 - `headers` (Object, Headers) - Default: `{}`
 - `credentials` (String) - Authentication credentials mode.

See [https://github.github.io/fetch/](https://github.github.io/fetch/) for more information.

### Method helpers
| `method` | Queue function.    |
| -------- | ------------------ |
| `GET`    | `queue.get(...)`   |
| `POST`   | `queue.post(...)`  |
| `PUT`    | `queue.put(...)`   |
| `PATCH`  | `queue.patch(...)` |
| `DELETE` | `queue.del(...)`   |
| `HEAD`   | `queue.head(...)`  |

### Middleware
There are four sorts of middleware that you can add to your queues in order to extend their features. You can for example add a middleware that will add support to JSON, or add headers for authentication.

#### Request middleware
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
Queue handler is a special function that will give you control over the way your queue processes queries:

 - if you want to pause the processing of the queue, you can return a `Promise` (which you resolve whenver you want),
 - if you want to nack your query (that is, not removing it from the queue, but *replay* it instead), you can `throw` an error or return a `Promise.reject()`.

Be careful when using both of these options because they can either stop your queue from processing indefinitely or make it process the same request over and over again.

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
To connect these middleware to your queue, your can use `connectMiddleware`:

```
const { createQueue, connectMiddleware } = require('magic-fetch');

const createDefaultQueue = connectMiddleware(requestMiddleware,
                                             responseMiddleware,
                                             errorMiddleware,
                                             queueHandler)(createQueue);
const queue = createDefaultQueue(fetch);
```

If you want to skip a middleware, just pass `null`. Example:

```
const createDefaultQueue = connectMiddleware(null, null, null, queueHandler)(createQueue);
```

#### Combine middleware
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