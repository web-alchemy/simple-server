const { Server, STATUS_CODES } = require('http');
const { on, EventEmitter } = require('events');
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

class WebServer extends Server {
  [Symbol.asyncIterator]() {
    return on(this, 'request');
  }
}

class Application extends EventEmitter {
  constructor(options) {
    super({
      captureRejections: true,
      ...options
    });
  }

  [Symbol.for('nodejs.rejection')](error) {
    const context = asyncLocalStorage.getStore();
    this.handleError(context, error);
  }

  hasListeners(eventName) {
    return this.listenerCount(eventName) > 0;
  }

  handleError(context, error) {
    context.error = error;
    if (this.hasListeners('error')) {
      this.emit('error', context);
    } else {
      switch (true) {
        case (error.name === 'NotFound'): {
          error.statusCode = 404;
          context.res.end(STATUS_CODES[404]);
          break;
        }
        default: {
          context.res.statusCode = 500;
          context.res.end((error ?? STATUS_CODES[500]).toString());
        }
      }
    }
  }

  async listen(...args) {
    const server = new WebServer();
    server.listen(...args);

    await Promise.resolve();

    for await (const [req, res] of server) {
      const context = { req, res };
      asyncLocalStorage.enterWith(context);
      try {
        const { method, url } = req;
        const eventName = method.toUpperCase() + ' ' + url;
        if (this.hasListeners(eventName)) {
          this.emit(eventName, context);
        }
        else {
          // TODO: handle via `app.on(Application.NOT_FOUND, (ctx) => {})`?
          const notFoundError = new Error('not found');
          notFoundError.name = 'NotFound';
          throw notFoundError;
        }
      } catch (error) {
        this.handleError(context, error);
      }
    }
  }
}

async function parseBody(req) {
  const body = [];
  for await (const chunk of req) {
    body.push(chunk);
  }
  return Buffer.concat(body).toString();
};


module.exports = Application;
module.exports.parseBody = parseBody;