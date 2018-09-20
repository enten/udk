/** app.js */

const express = require('express');
const { join } = require('path');

import './shared';

const BROWSER_DIST_PATH = join(__dirname, '..', 'client');

const getAssets = stats => (
  stats && stats.entrypoints && stats.entrypoints.main
    ? stats.entrypoints.main.assets.filter(file => !file.endsWith('.hot-update.js'))
    : []
);

const tagScript = file => `<script src="/client/${file}"></script>`;

const app = express();

app.use('/client', express.static(BROWSER_DIST_PATH));

app.get('/', (req, res) => {
  const webpackStats = res.locals.webpackStats || {};
  const webpackStatsClient = webpackStats.client || {};

  res.send(`
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>udk-base-example</title>
    </head>
    <body>
      <h1>Client stats</h1>
      <p>Yep! I'm the server and I have an access to the client's stats</p>
      <pre style="background: #ccc">
        ${JSON.stringify(webpackStatsClient, null, 2)}
      </pre>
      ${getAssets(webpackStatsClient).map(tagScript).join('')}
    </body>
  </html>
  `);
});

export default app;
