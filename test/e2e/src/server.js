/** server.js */

import { createServer } from 'http';

import app from './app';

let currentApp = app;

export const server = createServer((req, res) => {
  currentApp(req, res);
});

server.listen(3000, () => console.log('Server listening -- http://localhost:3000'))

// module.exports = server
export default server;

if (module.hot) {
  module.hot.accept('./app.js', () => {
    currentApp = require('./app.js').default;
  })
}

// throw new Error('fake');
// xxx





