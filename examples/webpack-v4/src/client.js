// src/client.js

import './shared';

console.log('Hello, client');

if (module.hot) {
  module.hot.accept();
}
