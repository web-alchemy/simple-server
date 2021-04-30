# Simple HTTP Server

## Installation

```bash
npm install @web-alchemy/simple-server
```

## Usage

```javascript
const WebServer = require('@web-alchemy/simple-server');

const app = new WebServer();

app.on('GET /', ({ req, res }) => {
  res.end('/index');
});

app.on('POST /create/', ({ req, res }) => {
  res.end('/create/');
});

app.on('@error', ({ req, res, error }) => {
  res.end(error.message ?? 'error');
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
})
```