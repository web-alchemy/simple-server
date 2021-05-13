# Simple HTTP Server

## Installation

```bash
npm install @web-alchemy/simple-server
```

## Usage

```javascript
const Application = require('@web-alchemy/simple-server');

const app = new Application();

app.on('GET /', ({ req, res }) => {
  res.end('/index');
});

app.on('POST /create/', ({ req, res }) => {
  res.end('/create/');
});

app.on('GET /some-error/', async ({ req, res }) => {
  throw new Error('boom');
})

app.on('error', ({ req, res, error }) => {
  res.end(error.message || 'error'); // boom (error from route `GET /some-error/`)
});

// works only if there is an handler `app.on('error', ctx => {})`
// https://nodejs.org/dist/latest-v14.x/docs/api/events.html#events_eventemitter_errormonitor
app.on(Application.errorMonitor, err => {
  console.log(err);
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
})
```
