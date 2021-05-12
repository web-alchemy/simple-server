const assert = require('assert').strict;
const { URL } = require('url');
const http = require('http');
const { once } = require('events');

const { Application } = require('..');

async function parseStreamToString(response) {
  let body = '';
  response.setEncoding('utf-8');
  response.on('data', chunk => body += chunk);
  await once(response, 'end');
  return body;
}

async function sendRequest(url, method, reqBody) {
  const req = http.request(url, { method });
  req.end(reqBody);
  const [response] = await once(req, 'response');
  const body = await parseStreamToString(response);
  return {
    response,
    body
  }
}

describe('@web-alchemy/simple-server', function() {
  const PORT = 3000;
  const BASE_URL = `http://localhost:${PORT}`;
  let app;

  beforeEach(done => {
    app = new Application();
    app.listen(PORT, done);
  });

  afterEach((done) => {
    app.close(done);
  });

  ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach((HTTP_METHOD) => {
    it(`${HTTP_METHOD} /`, async () => {
      const STATUS_CODE = 200;
      const STATUS_MESSAGE = http.STATUS_CODES[STATUS_CODE];

      app.on(`${HTTP_METHOD} /`, (ctx) => {
        const { res, req } = ctx;

        assert.equal(req.method.toUpperCase(), HTTP_METHOD, `Method should be '${HTTP_METHOD}'`);
        assert.equal(req.url, '/', `url should be '/'`);

        res.statusCode = STATUS_CODE;
        res.statusMessage = STATUS_MESSAGE;
        res.end(STATUS_MESSAGE);
      });

      const { response, body } = await sendRequest(BASE_URL + '/', HTTP_METHOD);

      assert.equal(response.statusCode, STATUS_CODE, `Status code should be ${STATUS_CODE}`);
      assert.equal(response.statusMessage, STATUS_MESSAGE, `Status message should be ${STATUS_MESSAGE}`);
      assert.equal(body, STATUS_MESSAGE, `Response body should be ${STATUS_MESSAGE}`);
    });
  });

  it('It should handle 404 route', async () => {
    const STATUS_CODE = 404;
    const STATUS_MESSAGE = http.STATUS_CODES[STATUS_CODE];

    const { response, body } = await sendRequest(BASE_URL + '/not-exist-route/', 'GET');

    assert.equal(response.statusCode, STATUS_CODE, `Status code should be ${STATUS_CODE}`);
    assert.equal(response.statusMessage, STATUS_MESSAGE, `Status message should be ${STATUS_MESSAGE}`);
    assert.equal(body, STATUS_MESSAGE, `Response body should be ${STATUS_MESSAGE}`);
  });

  it('It should handle common server 500 error with message', async () => {
    const STATUS_CODE = 500;
    const STATUS_MESSAGE = http.STATUS_CODES[STATUS_CODE];
    const ERROR_MESSAGE = 'error message';
    const ROUTE_WITH_MESSAGE = '/500-error/';

    app.on(`GET ${ROUTE_WITH_MESSAGE}`, async () => {
      throw new Error(ERROR_MESSAGE);
    });

    const { response, body } = await sendRequest(BASE_URL + ROUTE_WITH_MESSAGE, 'GET');

    assert.equal(response.statusCode, STATUS_CODE, `Status code should be ${STATUS_CODE}`);
    assert.equal(response.statusMessage, STATUS_MESSAGE, `Status message should be ${STATUS_MESSAGE}`);
    assert.equal(body, ERROR_MESSAGE, `Response body should be ${ERROR_MESSAGE}`);
  });

  it('It should handle common server 500 error without message', async () => {
    const STATUS_CODE = 500;
    const STATUS_MESSAGE = http.STATUS_CODES[STATUS_CODE];
    const ROUTE_WITHOUT_MESSAGE = '/500-error-without-message/';

    app.on(`GET ${ROUTE_WITHOUT_MESSAGE}`, async () => {
      throw new Error();
    });

    const { response, body } = await sendRequest(BASE_URL + ROUTE_WITHOUT_MESSAGE, 'GET');

    assert.equal(response.statusCode, STATUS_CODE, `Status code should be ${STATUS_CODE}`);
    assert.equal(response.statusMessage, STATUS_MESSAGE, `Status message should be ${STATUS_MESSAGE}`);
    assert.equal(body, STATUS_MESSAGE, `Response body should be ${STATUS_MESSAGE}`);
  });

  it('should handle error with custom handler', async () => {
    const STATUS_CODE = 500;
    const STATUS_MESSAGE = http.STATUS_CODES[STATUS_CODE];
    const ERROR_MESSAGE = 'some custom error message';
    const ROUTE_WITH_MESSAGE = '/500-error/';

    app.on(`GET ${ROUTE_WITH_MESSAGE}`, async () => {
      throw new Error(ERROR_MESSAGE);
    });

    app.on('error', async (ctx) => {
      const { error, req, res } = ctx;
      assert.ok(error, `Error object should exist`);
      assert.equal(error.message, ERROR_MESSAGE, `Error message should be ${ERROR_MESSAGE}`);
      res.statusCode = STATUS_CODE;
      res.statusMessage = STATUS_MESSAGE;
      res.end(ERROR_MESSAGE);
    });

    const { response, body } = await sendRequest(BASE_URL + ROUTE_WITH_MESSAGE, 'GET');

    assert.equal(response.statusCode, STATUS_CODE, `Status code should be ${STATUS_CODE}`);
    assert.equal(response.statusMessage, STATUS_MESSAGE, `Status message should be ${STATUS_MESSAGE}`);
    assert.equal(body, ERROR_MESSAGE, `Response body should be ${ERROR_MESSAGE}`);
  })
});