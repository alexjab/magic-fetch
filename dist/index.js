'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EventEmitter = require('events');

var STATES = {
  BUSY: 'busy',
  IDLE: 'idle'
};

var DEFAULT_MIDDLEWARE = {
  REQUEST: function REQUEST(request) {
    return request;
  },
  RESPONSE: function RESPONSE(response) {
    return response;
  },
  ERROR: function ERROR(error) {
    return error;
  }
};

var DEFAULT_QUEUE_HANDLER = function DEFAULT_QUEUE_HANDLER() {
  return null;
};

var CONTENT_TYPE_REGEX = /application\/json/;

var Deferred = function Deferred() {
  var _this = this;

  _classCallCheck(this, Deferred);

  this.Promise = new Promise(function (resolve, reject) {
    _this.resolve = resolve;
    _this.reject = reject;
  });
};

function applyDefaultRequest(request) {
  request.method = request.method || 'GET';
  request.headers = request.headers || {};
  request._deferred = new Deferred();

  return request;
}

function makeRequest(fetch, request) {
  var url = request.url,
      method = request.method,
      headers = request.headers,
      body = request.body,
      credentials = request.credentials;

  if (!url) return Promise.reject(new Error('Field url is required in request'));

  return fetch(url, {
    method: method,
    body: body,
    headers: headers,
    credentials: credentials
  }).then(function (response) {
    var status = response.status,
        statusText = response.statusText,
        ok = response.ok,
        headers = response.headers,
        url = response.url;


    return response.text().then(function (text) {
      var payload = {
        response: response,
        headers: headers,
        ok: ok,
        status: status,
        statusText: statusText,
        text: text
      };

      if (CONTENT_TYPE_REGEX.test(response.headers.get('content-type'))) {
        try {
          payload.body = JSON.parse(text);
        } catch (error) {
          payload.body = {};
        }
      }
      return payload;
    });
  });
}

function createQueue(fetch) {
  var requestMiddleware = this && this.requestMiddleware || DEFAULT_MIDDLEWARE.REQUEST;
  var responseMiddleware = this && this.responseMiddleware || DEFAULT_MIDDLEWARE.RESPONSE;
  var errorMiddleware = this && this.errorMiddleware || DEFAULT_MIDDLEWARE.ERROR;
  var queueHandler = this && this.queueHandler || DEFAULT_QUEUE_HANDLER;

  var ee = new EventEmitter();

  var queue = [];
  var state = STATES.IDLE;

  var push = function push(request) {
    request = applyDefaultRequest(request);
    queue.push(request);

    if (state === STATES.IDLE) {
      ee.emit('__next__');
    }

    return request._deferred.Promise;
  };

  var get = function get(request) {
    request.method = 'GET';
    return push(request);
  };

  var post = function post(request) {
    request.method = 'POST';
    return push(request);
  };

  var put = function put(request) {
    request.method = 'PUT';
    return push(request);
  };

  var patch = function patch(request) {
    request.method = 'PATCH';
    return push(request);
  };

  var del = function del(request) {
    request.method = 'DELETE';
    return push(request);
  };

  var head = function head(request) {
    request.method = 'HEAD';
    return push(request);
  };

  var next = function next() {
    if (!queue.length) {
      state = STATES.IDLE;
      return;
    }

    state = STATES.BUSY;

    var originalRequest = queue[0];
    var request = void 0;
    try {
      request = requestMiddleware(originalRequest);
    } catch (error) {
      ee.emit('unhandledError', error);
    }

    var isNacked = false;
    var err = null;
    var res = null;

    var action = void 0;
    if (!request) {
      action = Promise.resolve();
    } else {
      action = makeRequest(fetch, request).catch(function (error) {
        err = errorMiddleware(error, request);
        return null;
      }).then(function (response) {
        if (!response) return null;
        res = responseMiddleware(response, request);
      }).catch(function (err) {
        return ee.emit('unhandledError', err);
      });
    }

    action.then(function () {
      return queueHandler(err, res, request);
    }).catch(function () {
      return isNacked = true;
    }).then(function () {
      if (!isNacked) {
        queue.shift();
        if (err) {
          originalRequest._deferred.reject(err);
        } else {
          originalRequest._deferred.resolve(res);
        }
      }
      ee.emit('__next__');
    });
  };

  ee.on('__next__', next);

  return {
    push: push,
    get: get,
    head: head,
    post: post,
    put: put,
    patch: patch,
    del: del,
    delete: del,
    on: ee.on.bind(ee)
  };
}

function connectMiddleware(requestMiddleware, responseMiddleware, errorMiddleware, queueHandler) {
  return function (fn) {
    return fn.bind({ requestMiddleware: requestMiddleware, responseMiddleware: responseMiddleware, errorMiddleware: errorMiddleware, queueHandler: queueHandler });
  };
}

function combineMiddleware() {
  for (var _len = arguments.length, fn = Array(_len), _key = 0; _key < _len; _key++) {
    fn[_key] = arguments[_key];
  }

  var N = fn.length - 1;

  function callArg(n) {
    for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    if (n === 0) return fn[0].apply(fn, args);
    return fn[n].apply(fn, [callArg.apply(undefined, [n - 1].concat(args))].concat(_toConsumableArray(args.slice(1))));
  }
  return function () {
    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    return callArg.apply(undefined, [N].concat(args));
  };
}

module.exports = {
  createQueue: createQueue,
  connectMiddleware: connectMiddleware,
  combineMiddleware: combineMiddleware
};