// src/server.js

import './shared';

console.log('Hello, server');

if (module.hot) {
  module.hot.accept();
}
