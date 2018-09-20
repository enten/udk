// src/server.ts

import './shared';

console.log('Hello, server');

if (module.hot) {
  module.hot.accept();
}
