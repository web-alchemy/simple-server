const { Server, STATUS_CODES } = require('http');
const { on } = require('events');

class WebServer extends Server {
  [Symbol.asyncIterator]() {
    return on(this, 'request');
  }

  hasListeners(eventName) {
    return this.listenerCount(eventName) > 0;
  }

  async listen(...args) {
    super.listen(...args);

    await Promise.resolve();

    for await (const [req, res] of this) {
      const context = { req, res };
      try {
        const { method, url } = req;
        const eventName = method.toUpperCase() + ' ' + url;
        if (this.hasListeners(eventName)) {
          this.emit(eventName, context);
        } else {
          const notFoundError = new Error('not found');
          notFoundError.name = 'NotFound';
          throw notFoundError;
        }
      } catch (error) {
        if (this.hasListeners('@error')) {
          context.error = error;
          this.emit('@error', context);
        } else {
          switch (true) {
            case (error.name === 'NotFound'): {
              error.statusCode = 404;
              res.end(STATUS_CODES[404]);
              break;
            }
            default: {
              res.statusCode = 500;
              res.end((error ?? STATUS_CODES[500]).toString());
            }
          }
        }
      }
    }
  }
}

module.exports = WebServer;