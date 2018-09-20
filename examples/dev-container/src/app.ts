// src/app.ts

import * as express from 'express';
import * as path from 'path';

import './shared';

const BROWSER_DIST_PATH = path.join(__dirname, '..', 'client');

const app = express();

app.use(express.static(BROWSER_DIST_PATH));

app.get('/', (req, res) => {
  const webpackStats = res.locals.webpackStats || {};
  const webpackStatsClient = webpackStats.client || {};

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
      <script src="main.js"></script>
    </body>
  </html>
  `);
});

export default app;
