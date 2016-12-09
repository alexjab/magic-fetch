'use strict';

const fetch = require('node-fetch');

const { expect } = require('./chai');
const nock = require('nock');
const sinon = require('sinon');

const { createQueue,
  connectMiddleware,
  combineMiddleware } = require('../index');

import test from 'ava';

function newHost() {
  const host = `http://localhost:${Math.round(1000 + Math.random() * 55535)}`;
  return host;
}

test('createQueue > returns "push" method', t => {
  const queue = createQueue(fetch);
  expect(queue).to.exist();
  expect(queue.push).to.exist();

  t.pass();
});

test('queue.push > should push a request in the queue', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).get('/').reply(200);

  await queue.push({
    url: host + '/'
  });

  t.pass();
});

test('queue.push > at push, should wait before a request finishes', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).get('/foo').delay(500).reply(200);
  nock(host).get('/bar').reply(200);

  queue.push({
    url: host + '/foo'
  });
  await queue.push({
    url: host + '/bar'
  });

  t.pass();
});

test.serial('queue.push > should throw an error', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).get('/').replyWithError('SOME_ERROR');

  let error;
  try {
    await queue.push({
      url: host + '/'
    });
  } catch(err) {
    error = err;
  }

  expect(error).to.exist();
  expect(error.message).to.match(/SOME_ERROR/ig);

  t.pass();
});

test('queue.push > should throw an error (no url specified)', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  let error;
  try {
    await queue.push({
      method: 'GET'
    });
  } catch(err) {
    error = err;
  }

  expect(error).to.exist();
  expect(error.message).to.match(/^Field url is required in request$/);

  t.pass();
});

test('queue.get > should make a GET request', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).get('/').reply(200);

  await queue.get({
    url: host + '/'
  });

  t.pass();
});

test('queue.head > should make a HEAD request', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).head('/').reply(200);

  await queue.head({
    url: host + '/'
  });

  t.pass();
});

test('queue.post > should make a POST request', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).post('/').reply(201);

  await queue.post({
    url: host + '/'
  });

  t.pass();
});

test('queue.put > should make a PUT request', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).put('/').reply(200);

  await queue.put({
    url: host + '/'
  });

  t.pass();
});

test('queue.patch > should make a PATCH request', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).patch('/').reply(200);

  await queue.patch({
    url: host + '/'
  });

  t.pass();
});

test('queue.del > should make a DELETE request', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).delete('/').reply(200);

  await queue.del({
    url: host + '/'
  });

  t.pass();
});

test('queue.delete > should make a DELETE request', async t => {
  const host = newHost();
  const queue = createQueue(fetch);

  nock(host).delete('/').reply(200);

  await queue.delete({
    url: host + '/'
  });

  t.pass();
});


test('[requestMiddleware] > should go through the request middleware', async t => {
  const host = newHost();
  let requestCalls = 0;
  const createDefaultQueue = connectMiddleware(req => {
    requestCalls++;
    return req;
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').reply(200);

  await queue.push({
    url: host + '/'
  });

  expect(requestCalls).to.equal(1);

  t.pass();
});

test('[requestMiddleware] > should pass req to the request middleware', async t => {
  const host = newHost();
  const requestCalls = [];
  const createDefaultQueue = connectMiddleware((...args) => {
    requestCalls.push(args);
    return args[0];
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').reply(200);

  await queue.push({
    url: host + '/',
    type: 'SOMETHING'
  });

  expect(requestCalls).to.have.lengthOf(1);
  expect(requestCalls[0]).to.have.lengthOf(1);
  const firstCall = requestCalls[0];
  expect(firstCall[0]).to.have.property('url', host + '/');
  expect(firstCall[0]).to.have.property('method', 'GET');
  expect(firstCall[0]).to.have.property('headers');
  expect(firstCall[0].headers).to.deep.equal({});
  expect(firstCall[0]).to.have.property('type', 'SOMETHING');
  expect(firstCall[0]).to.have.property('_deferred');

  t.pass();
});

test('[responseMiddleware] > if an error happens, it should not nack the response', async t => {
  const host = newHost();
  let responseCalls = 0;
  const createDefaultQueue = connectMiddleware(res => {
    responseCalls++;
    throw new Error();
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').reply(200);

  await queue.push({
    url: host + '/'
  });

  expect(responseCalls).to.equal(1);

  t.pass();
});

test('[responseMiddleware] > if an error happens, it should emit an `unhandledError` event', async t => {
  const host = newHost();
  const createDefaultQueue = connectMiddleware(null, res => {
    throw new Error('Foo bar');
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').reply(200);

  queue.push({
    url: host + '/'
  });

  let error;
  await new Promise((resolve) => queue.on('unhandledError', (err) => {
    error = err;
    resolve();
  }));

  expect(error).to.exist();
  expect(error).to.have.property('message', 'Foo bar');

  t.pass();
});

test('[responseMiddleware] > should go through the response middleware', async t => {
  const host = newHost();
  let responseCalls = 0;
  const createDefaultQueue = connectMiddleware(null, res => {
    responseCalls++;
    return res;
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').reply(200);

  await queue.push({
    url: host + '/'
  });

  expect(responseCalls).to.equal(1);

  t.pass();
});

test('[responseMiddleware] > should pass res and req object to the response middleware', async t => {
  const host = newHost();
  const responseCalls = [];
  let req;
  const createDefaultQueue = connectMiddleware(r => req = r, (...args) => {
    responseCalls.push(args);
    return {};
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').reply(200);

  await queue.push({
    url: host + '/'
  });

  expect(responseCalls).to.have.lengthOf(1);
  expect(responseCalls[0]).to.have.lengthOf(2);
  const firstCall = responseCalls[0];
  expect(firstCall[0]).to.have.property('response');
  expect(firstCall[0]).to.have.property('ok');
  expect(firstCall[0]).to.have.property('status');
  expect(firstCall[0]).to.have.property('statusText');
  expect(firstCall[0]).to.have.property('headers');
  expect(firstCall[0]).to.have.property('text');
  expect(firstCall[1]).to.equal(req);

  t.pass();
});

test('[requestMiddleware] > if an error happens, it should not block the queue', async t => {
  const host = newHost();
  let requestCalls = 0;
  const createDefaultQueue = connectMiddleware(req => {
    if (req.url.match(/foo/)) {
      throw new Error();
    }
    requestCalls++;
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/bar').reply(200);

  await queue.push({
    url: host + '/foo'
  });
  await queue.push({
    url: host + '/bar'
  });

  expect(requestCalls).to.equal(1);

  t.pass();
});

test('[requestMiddleware] > if an error happens, it should emit an `unhandledError` event', async t => {
  const host = newHost();
  const createDefaultQueue = connectMiddleware(req => {
    throw new Error('Foo bar');
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').reply(200);

  let error;
  const errorPromise = new Promise((resolve) => queue.on('unhandledError', (err) => {
    error = err;
    resolve();
  }))

  queue.push({
    url: host + '/'
  });

  await errorPromise;

  expect(error).to.exist();
  expect(error).to.have.property('message', 'Foo bar');

  t.pass();
});

test.serial('[errorMiddleware] > should go through the error middleware', async t => {
  const host = newHost();
  let errorCalls = 0;
  const createDefaultQueue = connectMiddleware(null, null, err => {
    errorCalls++;
    return err;
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').replyWithError('SOME_ERROR');
  
  let error;
  try {
    await queue.push({
      url: host + '/'
    });
  } catch(err) {
    error = err;
  }

  expect(errorCalls).to.equal(1);

  t.pass();
});

test.serial('[errorMiddleware] > should err and request to the error middleware', async t => {
  const host = newHost();
  const errorCalls = [];
  let req;
  const createDefaultQueue = connectMiddleware(r => req = r, null, (...args) => {
    errorCalls.push(args);
    return args[0];
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').replyWithError('SOME_ERROR');
  
  let error;
  try {
    await queue.push({
      url: host + '/'
    });
  } catch(err) {
    error = err;
  }

  expect(errorCalls).to.have.lengthOf(1);
  expect(errorCalls[0]).to.have.lengthOf(2);
  const firstCall = errorCalls[0];
  expect(firstCall[0]).to.be.instanceOf(Error);
  expect(firstCall[1]).to.equal(req);

  t.pass();
});

test('[errorMiddleware] > if an error happens, it should not nack the response', async t => {
  const host = newHost();
  let errorCalls = 0;
  const createDefaultQueue = connectMiddleware(null, null, err => {
    errorCalls++;
    throw new Error();
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').replyWithError('SOME_ERROR');

  await queue.push({
    url: host + '/'
  });

  expect(errorCalls).to.equal(1);

  t.pass();
});

test('[errorMiddleware] > if an error happens, it should emit an `unhandledError` event', async t => {
  const host = newHost();
  const createDefaultQueue = connectMiddleware(null, null, err => {
    throw new Error('Foo bar');
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').replyWithError('SOME_ERROR');

  queue.push({
    url: host + '/'
  });

  let error;
  await new Promise((resolve) => queue.on('unhandledError', (err) => {
    error = err;
    resolve();
  }));

  expect(error).to.exist();
  expect(error).to.have.property('message', 'Foo bar');

  t.pass();
});

test('connectMiddleware > should go through the queue handler', async t => {
  const host = newHost();
  let actionCalls = 0;
  const createDefaultQueue = connectMiddleware(null, null, null, (err, res, req) => {
    actionCalls++;
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').reply(200);

  await queue.push({
    url: host + '/'
  });

  expect(actionCalls).to.equal(1);

  t.pass();
});

test('[queueHandler] > should nack the request if the queue handler throws an error', async t => {
  const host = newHost();
  let requestCalls = 0;
  let responseCalls = 0;
  let actionCalls = -1;
  const createDefaultQueue = connectMiddleware(
    (req) => {
      requestCalls++;
      return req;
    },
    (res) => responseCalls++,
    (err) => errorCalls++,
    (err, res) => {
      actionCalls++;
      if (!actionCalls) throw new Error();
    }
  )(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/').times(2).reply(200);

  await queue.push({
    url: host + '/'
  });

  expect(requestCalls).to.equal(2);
  expect(responseCalls).to.equal(2);
  expect(actionCalls).to.equal(1);

  t.pass();
});

test('[requestMiddleware] > should skip the request if request is null', async t => {
  const host = newHost();
  let requestCalls = -1;
  const createDefaultQueue = connectMiddleware(req => {
    requestCalls++;
    if (!requestCalls) return null;
    return req;
  })(createQueue);
  const queue = createDefaultQueue(fetch);

  nock(host).get('/bar').reply(200);

  await queue.push({
    url: host + '/foo'
  });
  await queue.push({
    url: host + '/bar'
  });

  t.pass();
});

test('[combineMiddleware] > should return a function', t => {
  const mid = combineMiddleware(() => null);

  expect(mid).to.be.a('function');

  t.pass();
});

test('[combineMiddleware] > should go through all functions', t => {
  let goneThroughFn1 = false;
  let goneThroughFn2 = false;
  let goneThroughFn3 = false;

  function fn1() {
    goneThroughFn1 = true;
  }
  function fn2() {
    goneThroughFn2 = true;
  }
  function fn3() {
    goneThroughFn3 = true;
  }

  combineMiddleware(fn1, fn2, fn3)();

  expect(goneThroughFn1).to.be.true();
  expect(goneThroughFn2).to.be.true();
  expect(goneThroughFn3).to.be.true();

  t.pass();
});

test('[combineMiddleware] > should pass the first arguments down the line of middleware', t => {
  const calls = [];

  function fn1(arg) {
    calls.push(arg);
    return arg*2;
  }
  function fn2(arg) {
    calls.push(arg);
    return arg*2;
  }
  function fn3(arg) {
    calls.push(arg);
    return arg*2;
  }

  combineMiddleware(fn1, fn2, fn3)(2);

  expect(calls).to.deep.equal([2, 4, 8]);

  t.pass();
});

test('[combineMiddleware] > should pass the rest of the arguments down the line of middleware as is', t => {
  const calls = [];

  function fn1(...args) {
    calls.push(args);
    return args[0]*2;
  }
  function fn2(...args) {
    calls.push(args);
    return args[0]*2;
  }
  function fn3(...args) {
    calls.push(args);
    return args[0]*2;
  }

  combineMiddleware(fn1, fn2, fn3)(2, 'foo', 'bar', 'baz');

  expect(calls).to.have.lengthOf(3);
  expect(calls[0]).to.deep.equal([2, 'foo', 'bar', 'baz']);
  expect(calls[1]).to.deep.equal([4, 'foo', 'bar', 'baz']);
  expect(calls[2]).to.deep.equal([8, 'foo', 'bar', 'baz']);

  t.pass();
});
