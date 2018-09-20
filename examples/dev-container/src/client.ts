// src/client.ts

import './shared';

console.log('Hello, client');

if (module.hot) {
  module.hot.accept();
}
