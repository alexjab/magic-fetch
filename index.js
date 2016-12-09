'use strict';

const EventEmitter = require('events');

const STATES = {
  BUSY: 'busy',
  IDLE: 'idle'
};

const DEFAULT_MIDDLEWARE = {
  REQUEST: request => request,
  RESPONSE: response => response,
  ERROR: error => error
};

const DEFAULT_QUEUE_HANDLER = () => null;

class Deferred {
  constructor() {
    this.Promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

function applyDefaultRequest(request) {
  request.method = request.method || 'GET';
  request.headers = request.headers || {};
  request._deferred = new Deferred();

  return request;
}

function makeRequest(fetch, request) {
  const { url, method, headers, body, credentials } = request;
  if (!url) return Promise.reject(new Error('Field url is required in request'));

  return fetch(url, {
    method,
    body,
    headers,
    credentials
  })
  .then(response => {
    const { status, statusText, ok, headers, url } = response;

    return response.text().then(text => {
      return {
        response,
        headers,
        ok,
        status,
        statusText,
        text
      };
    })
  });
}

function createQueue(fetch) {
  const requestMiddleware = this && this.requestMiddleware || DEFAULT_MIDDLEWARE.REQUEST;
  const responseMiddleware = this && this.responseMiddleware || DEFAULT_MIDDLEWARE.RESPONSE;
  const errorMiddleware = this && this.errorMiddleware || DEFAULT_MIDDLEWARE.ERROR;
  const queueHandler = this && this.queueHandler || DEFAULT_QUEUE_HANDLER;

  const ee = new EventEmitter();

  const queue = [];
  let state = STATES.IDLE;

  const push = (request) => {
    request = applyDefaultRequest(request);
    queue.push(request);

    if (state === STATES.IDLE) {
      ee.emit('__next__');
    }

    return request._deferred.Promise;
  };

  const get = (request) => {
    request.method = 'GET';
    return push(request);
  };

  const post = (request) => {
    request.method = 'POST';
    return push(request);
  };

  const put = (request) => {
    request.method = 'PUT';
    return push(request);
  };

  const patch = (request) => {
    request.method = 'PATCH';
    return push(request);
  };

  const del = (request) => {
    request.method = 'DELETE';
    return push(request);
  };

  const head = (request) => {
    request.method = 'HEAD';
    return push(request);
  };

  const next = () => {
    if (!queue.length) {
      state = STATES.IDLE;
      return;
    }

    state = STATES.BUSY;

    let originalRequest = queue[0];
    let request;
    try {
      request = requestMiddleware(originalRequest);
    } catch(error) {
      ee.emit('unhandledError', error);
    }

    let isNacked = false;
    let err = null;
    let res = null;

    let action;
    if (!request) {
      action = Promise.resolve();
    } else {
      action = makeRequest(fetch, request)
        .catch(error => {
          err = errorMiddleware(error, request);
          return null;
        })
        .then(response => {
          if (!response) return null;
          res = responseMiddleware(response, request);
        })
        .catch(err => ee.emit('unhandledError', err));
    }

    action.then(() => queueHandler(err, res, request))
    .catch(() => isNacked = true)
    .then(() => {
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
    push,
    get,
    head,
    post,
    put,
    patch,
    del,
    delete: del,
    on: ee.on.bind(ee)
  };
}

function connectMiddleware(requestMiddleware, responseMiddleware, errorMiddleware, queueHandler) {
  return (fn) => fn.bind({ requestMiddleware, responseMiddleware, errorMiddleware, queueHandler });
}

function combineMiddleware(...fn) {
  const N = fn.length - 1;

  function callArg(n, ...args) {
    if (n === 0) return fn[0](...args);
    return fn[n](callArg(n-1, ...args), ...args.slice(1));
  }
  return (...args) => callArg(N, ...args);
}

module.exports = {
  createQueue,
  connectMiddleware,
  combineMiddleware
};
