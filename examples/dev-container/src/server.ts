// src/server.ts

console.log('Hello, server');

import { Server, createServer } from 'http';
import app from './app';

let requestListener = app;

const server: Server = createServer((req, res) => requestListener(req, res));

server.listen(3000, () => console.log('Server listening -- http://localhost:3000'));

export default server;

if (module.hot) {
  module.hot.accept('./app', () => {
    requestListener = require('./app').default;
  });
}
