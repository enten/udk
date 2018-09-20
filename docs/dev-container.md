## Dev Container

### Features

* Run webpack compiler in child process (the main process is the  container).
* Restarts the container when a metafile like webpack configuration changed.
* Enables universal [HMR](https://webpack.js.org/concepts/hot-module-replacement/) for `web` and `node` bundles.
* Runs each `node` bundle and restarts it when a compilation is done.
* Decorates the request listener if a `node` bundle exports an [http server](https://nodejs.org/api/http.html#http_class_http_server) with  [webpack-hot-middleware](https://github.com/glenjamin/webpack-hot-middleware).

### Command Line Interface

Run a dev container with a configuration file given in `--config` parameter.

*If no `container config path` was given, the CLI will try to resolve `udk.container.js`, `udk.config.js` or `udkfile.js` in the current working directory.*

```shell
udkc [--config udk.container.js] [--debug]
```

Other file extensions can be used by using `--require` parameter which allows to preload a module.

```shell
npm install -D ts-node
udkc --require ts-node/register --config udk.container.ts
```

### About

A dev container is a process which **forked a webpack compiler in child process and performs some operations to increase developer productivity** when he deals with universal application.

In our context, we can define *universal application* as an application compiled from multiple configurations which have dependencies between them (at least client and server configurations).

Developing an universal application requires to write specific code for development purposes only. It's often a source of pain to write and maintain that kind of scattered fixtures which pollutes the code. It's also a real challenge to find the right combination of tools and configurations to set up an optimized development environment.

Let the dev container do that work for you.

### Motivation

> These last months I figured that [tension](https://github.com/enten/tension) is a wrong approach of what must be an universal toolchain.
> I wrote `udk` to improve how webpack achieves watching compilation based on multi-configuration with dependencies between them.
> I also wrote a [dev container](#dev-container) to won't have to write specific code for development purposes: allows hot reloading on webpack, client and server layers and no more issue to handle with the latest client's stats on the server side.
> ...
> I hope that `udk` can help developers simplify their toolchain.

[@enten](https://github.com/enten) to [@ctrl](https://github.com/ctrlplusb) – Oct 22, 2017

### How it works

* **It use a container configuration file**. Standard configuration names are: `udk.container.js`, `udk.config.js` and `udkfile.js`.
* That container configuration **can be empty or specify some options** to change or override the container behavior.
* If the option `hmr` is enabled (default behavior), *node* and *web* configurations are updated to inject entries and plugins needed for [HMR](https://webpack.js.org/concepts/hot-module-replacement/).
  * All configs: add plugins [`NoEmitOnErrorsPlugin`](https://webpack.js.org/plugins/no-emit-on-errors-plugin/) and [`HotModuleReplacementPlugin`](https://webpack.js.org/plugins/hot-module-replacement-plugin/)
  * *Node* configs: prepend entry [`webpack/hot/poll.js`](https://github.com/webpack/webpack/blob/master/hot/poll.js)
  * *Web* configs: prepend entry [`webpack-hot-middleware/client.js`](https://github.com/glenjamin/webpack-hot-middleware/blob/master/client.js)
* The container instantiates a compiler (based on webpack config file found along the container config file) and calls [`watch`](https://webpack.js.org/api/node/#watching).to starts watching.
* When a compilation is done the container requires *node* bundles (configurations which has `node` as target).
* *Node* bundles can be restarted at each compilation with the container option `autoRestart`.
* If a *node* bundle exports an [http server instance](https://nodejs.org/api/http.html#http_class_http_server), the container tries to decorate the request listener: it uses [webpack-hot-middleware](https://github.com/glenjamin/webpack-hot-middleware) if option `hmr` is enabled.
* The container will be restarted when a metafile has changed (container config, webpack config and each metafiles specify in the container config option `metafiles`).

<small>Note: in previous version, dev container serve assets of web bundles and injects stats in http requests. The features below was removed since udk  ^0.5.0.</small>

### Usage example

```shell
$ npx udkc --config ./udk.config.js
```

*Note: all options below are optional.*

```js
// udk.config.js

module.exports = {
  autoRestart: false,
  hmr: {
    enable: true,
    configs: undefined, // restrict HMR to configs which has its name in that option
    entries: ['main', 'index'], // restrict HMR to entries which has its name in that option
    entriesNode: ['server'], // concatenated with hmr.entries => ['server', 'main', 'index']
    entriesWeb: ['browser'], // concatenated with hmr.entries => ['browser', 'main', 'index']
    hotPollInterval: 1000,
    hotMiddleware: {
      path: '/__webpack_hmr'
    },
    hotMiddlewareClient: {
      overlay: true
    }
  },
  logger: console,
  metadirs: [],
  metafiles: [
    'udk.container.ts',
    'webpack.config.js',
  ],
  processTitle: 'udk-ctnr',
  topModuleEntries: [
    /^source-map-support/,
  ],
  watchOptions: {
    aggregateTimeout: 200,
  },
  webpackConfig: './webpack.config.js',

  bootstrap(container) {
    this.logger.info(`> bootstrap container (pid: ${container.proc.pid})`);
  },
  onUp(container) {
    this.logger.info(`>> container up (pid: ${container.proc.pid})`);
  },
  onDown(container) {
    this.logger.info('>> container down', { pid: container.proc.pid });
  },

  onCompilerShouldEmit(compiler, compilation) {
    this.logger.info(`>>> [${compiler.name}] compiler should emit`);

    return true;
  },
  onCompilerWatchRun(compiler, done) {
    this.logger.info(`>>> [${compiler.name}] watchRun`);
    done();
  },
  onCompilerBeforeCompile(compiler, compilationParams, done) {
    this.logger.info(`>>> [${compiler.name}] beforeCompile`);
    done();
  },
  onCompilerCompile(compiler, compilationParams) {
    this.logger.info(`>>> [${compiler.name}] compile`);
  },
  onCompilerThisCompilation(compiler, compilation, compilationParams) {
    this.logger.info(`>>> [${compiler.name}] thisCompilation`);
  },
  onCompilerCompilation(compiler, compilation, compilationParams) {
    this.logger.info(`>>> [${compiler.name}] compilation`);
  },
  onCompilerMake(compiler, compilation, done) {
    this.logger.info(`>>> [${compiler.name}] make`);
    done();
  },
  // onCompilerAfterCompile(compiler, compilation, done) {
  //   this.logger.info(`>>> [${compiler.name}] afterCompile`);
  //   done();
  // },
  onCompilerEmit(compiler, compilation, done) {
    this.logger.info(`>>> [${compiler.name}] emit`);
    done();
  },
  onCompilerAfterEmit(compiler, compilation, done) {
    this.logger.info(`>>> [${compiler.name}] afterEmit`);
    done();
  },
  onCompilerDone(compiler, compilation, done) {
    this.logger.info(`>>> [${compiler.name}] done`);

    if (done) {
      done();
    }
  },
  onCompilerFailed(compiler, err) {
    this.logger.info(`>>> [${compiler.name}] failed`);
  },
  onCompilerInvalid(compiler, fileName, changeTime) {
    this.logger.info(`>>> [${compiler.name}] invalid: ${fileName}`);
  },
  onCompilerWatchClose(compiler) {
    this.logger.info(`>>> [${compiler.name}] watchClose`);
  },
  onBundleAvailable(bundle) {
    this.logger.info(`>>> [${bundle.compiler.name}] bundleAvailable ${bundle.mainOutputPath}`);
  },
  prepareWebpackCompiler(compiler) {
    this.logger.info(`>> prepare compiler ${compiler.name}`);
  },
  prepareWebpackConfig(compiler) {
    this.logger.info(`>> prepare webpack config ${compiler.name}`);
  },
  printCompilerStats(stats) {
    this.logger.info(stats.toString({ colors: true }));
  },
  beforeRequireNodeBundle(compiler, mainOutputPath, stats) {
    this.logger.info(`>>> [${compiler.name}] before require node bundle`);
  },
  requestDecorator(bundle, req, res, next) {
    this.logger.info(`>>> [${bundle.name}] http request ${req.url}`);

    next();
  },
  injectWebpackStats(compilerStats, req, res) {
    const webpackStats = {};

    for (const name in compilerStats) {
      webpackStats[name] = compilerStats[name].toJson('verbose');
    }

    res.locals = res.locals || Object.create(null);
    res.locals.webpackStats = webpackStats;
  }
};
```

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "module": "commonjs",
    "target": "es5",
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "lib": [
      "dom",
      "es2015",
      "es2016"
    ],
    "types": [
      "node",
      "webpack-env"
    ],
    "typeRoots": [
      "./node_modules/@types"
    ],
    "jsx": "preserve",
    "rootDir": ".",
    "baseUrl": ".",
    "noImplicitAny": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "removeComments": false,
    "preserveConstEnums": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

```js
// webpack.config.js

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

const client = {
  mode,
  name: 'client',
  target: 'web',
  entry: './src/client.ts',
  output: {
    path: __dirname + '/dist/client',
    filename: 'main.js',
  },
  resolve: {
    extensions: [ '.ts', '.tsx', '.js' ],
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
    ],
  },
};

const server = {
  mode,
  name: 'server',
  target: 'node',
  dependencies: [ client.name ], // server depends on client
  entry: './src/server.ts',
  node: {
    __filename: false,
    __dirname: false,
  },
  output: {
    path: __dirname + '/dist/server',
    filename: 'main.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: [ '.ts', '.tsx', '.js' ],
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
    ],
  },
};

module.exports = [ client, server ]; // webpack multi config
```

```ts
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
```

```ts
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
```

```ts
// src/client.ts

import './shared';

console.log('Hello, client');

if (module.hot) {
  module.hot.accept();
}
```

```ts
// src/shared.ts

console.log('Hello, shared');
```