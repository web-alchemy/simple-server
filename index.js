const { Server, STATUS_CODES } = require('http');
const { EventEmitter } = require('events');
const { AsyncLocalStorage } = require('async_hooks');

function arrayEntries(array) {
  return array.map((item, index) => [item, index, array])
}

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

  getDynamicRouteMatch(originalUrlSegments, routeUrlSegments) {
    const result = {
      isMatch: false,
      parameters: {}
    }

    if (originalUrlSegments.length !== routeUrlSegments.length) {
      return result
    }

    const entries = arrayEntries(routeUrlSegments)

    for (const [item, index] of entries) {
      if (!item.isDynamic) {
        if (item.name !== originalUrlSegments[index]) {
          return result
        }
      }
    }

    const parameters = {}
    for (const [item, index] of entries) {
      if (item.isDynamic) {
        parameters[item.parameter] = originalUrlSegments[index]
      }
    }

    result.isMatch = true
    result.parameters = parameters

    return result
  }

  getDynamicMatch(originalMethod, originalUrl) {
    const dynamicRoutes = this.eventNames()
      .filter(eventName => eventName !== Application.NOT_FOUND_ROUTE && eventName !== 'error')
      .map(eventName => eventName.split(' '))
      .filter(([method, eventName]) => eventName.includes('/:'));

    const matchResult = {
      isMatch: false
    }

    if (dynamicRoutes.length === 0) {
      return matchResult;
    }

    const originalUrlSegments = originalUrl.split('/').filter(Boolean);

    for (const [method, routeURL] of dynamicRoutes) {
      if (originalMethod !== method) {
        continue;
      }

      const routeUrlSegments = routeURL
        .split('/')
        .filter(Boolean)
        .map(name => {
          const isDynamic = name.startsWith(':')
          return {
            name,
            isDynamic,
            parameter: isDynamic ? name.slice(1) : name
          }
        });

      if (originalUrlSegments.length !== routeUrlSegments.length) {
        continue;
      }

      const routeMatchInfo = this.getDynamicRouteMatch(originalUrlSegments, routeUrlSegments);

      if (routeMatchInfo.isMatch) {
        routeMatchInfo.method = method;
        routeMatchInfo.routeURL = routeURL
        return routeMatchInfo;
      }
    }

    return matchResult
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
          const dynamicRouteInfo = this.getDynamicMatch(method.toUpperCase(), url);
          if (dynamicRouteInfo.isMatch) {
            context.parameters = dynamicRouteInfo.parameters;
            this.emit(dynamicRouteInfo.method + ' ' + dynamicRouteInfo.routeURL, context);
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
        }
      } catch (error) {
        this.handleError(context, error);
      }
    });
  }

  listen(...args) {
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