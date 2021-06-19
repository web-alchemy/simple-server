const { Server, STATUS_CODES } = require('http');
const { EventEmitter } = require('events');
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

class Application extends EventEmitter {
  static NOT_FOUND_ROUTE = '__NOT_FOUND_ROUTE__';

  constructor(options) {
    super({
      captureRejections: true,
      ...options
    });
    this._server = new Server();
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
      const status = error.statusCode || error.status || 500;
      const statusMessage = STATUS_CODES[status];
      const message = error.message || statusMessage;
      context.res.statusCode = status;
      context.res.end(message);
    }
  }

  onRequest = (req, res) => {
    const context = { req, res };
    asyncLocalStorage.run(context, () => {
      try {
        const { method, url } = req;
        const eventName = method.toUpperCase() + ' ' + url;
        if (this.hasListeners(eventName)) {
          this.emit(eventName, context);
        } else {
          if (this.hasListeners(Application.NOT_FOUND_ROUTE)) {
            this.emit(Application.NOT_FOUND_ROUTE, context);
          } else {
            const notFoundError = new Error('Not Found');
            notFoundError.name = 'NotFound';
            notFoundError.status = notFoundError.statusCode = 404;
            throw notFoundError;
          }
        }
      } catch (error) {
        this.handleError(context, error);
      }
    });
  }

  async listen(...args) {
    this._server.on('request', this.onRequest);
    this._server.listen(...args);
  }

  close(callback) {
    return new Promise((resolve, reject) => {
      this._server.off('request', this.onRequest);
      this._server.close((error) => {
        if (error) {
          reject(error);
          callback && callback(error);
        } else {
          resolve();
          callback && callback();
        }
      })
    })
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
module.exports.Application = Application;
module.exports.parseBody = parseBody;