# Universal Development Kit

> Webpack extension which improves universal application development.

## Features

* Starts universal application development fastly (from scratch/without boilerplate)
* Designed on webpack's standard API
* Enhances compilers dependencies: sequential compilation according to dependency graph
* Enhances CLI watching: restarts watching process when webpack config changed
* **[Dev container](#dev-container) to increase developer productivity**: don't write specific code for development purposes anymore

## Install

```shell
npm install --save-dev udk webpack
```

## The Gist

```javascript
// webpack.config.js
const client = {
  name: 'client',
  entry: './client.js',
  output: {
    path: __dirname + '/build/client',
    filename: '[name].js'
  }
}

const server = {
  name: 'server',
  dependencies: [client.name],
  entry: './client.js',
  output: {
    path: __dirname + '/build/client',
    filename: '[name].js'
  }
}

module.exports = [
  client,
  server
]
```

```javascript
// client.js
require('./shared.js')

console.log('Hello, client')
```

```javascript
// server.js
require('./shared.js')

console.log('Hello, server')
```

```javascript
// shared.js
console.log('Hello, shared')
```

```shell
DEBUG=udk:* ./node_modules/.bin/udk.js --config webpack.config.js --watch
```

Now, try to update each file (`webpack.config.js` too) and check the output.

## Command Line Interfaces

### udk.js

Same as [webpack's CLI](https://webpack.js.org/api/cli/).

*The only difference is that [udk watches on config files and restarts the process if a change occurred](https://github.com/enten/udk/blob/1bea885e7079f0e94bceacca1f75607c4e93a8ee/bin/udk.js#L269).*

### [Usage with config file](https://webpack.js.org/api/cli/#usage-with-config-file)

```shell
udk [--config webpack.config.js]
```

### [Usage without config file](https://webpack.js.org/api/cli/#usage-without-config-file)

```shell
udk <entry> [<entry>] <output>
```

### udkc.js

Run a [dev container](#dev-container) with a configuration file given in first parameter.

*If no `container config path` was given, the CLI will try to resolve `udk.container.js`, `udk.config.js` or `udkfile.js` in the current working directory.*

```
$ udkc [udk.container.js]
```

## Dev Container

### About

A dev container is **forked in a child process and performs some operations to increase developer productivity** when he deals with universal application.

In our context, we can define *universal application* as an application compiled from multiple configurations which have dependencies between them.

Developing an universal application requires to write specific code for development purposes only. It's often a source of pain to write and maintain that kind of scattered fixtures which pollutes the code. It's also a real challenge to find the right combination of tools and configurations to set up an optimized development environment.

Let the dev container do that work for you.

* Restarts the container when webpack configurations or other metafiles changed.
* Enables [HMR](https://webpack.js.org/concepts/hot-module-replacement/) for `web` and `node` bundles.
* Runs each `node` bundle and restarts it when a compilation is done.
* Decorates the request listener if a `node` bundle exports an [http server](https://nodejs.org/api/http.html#http_class_http_server)
  * Mounts [webpack-hot-middleware](https://github.com/glenjamin/webpack-hot-middleware) if [HMR](https://webpack.js.org/concepts/hot-module-replacement/) is enabled ;
  * Serves the assets of `web` bundles ;
  * Injects the stats of `web` bundles.

### Motivation

> These last months I figured that [tension](https://github.com/enten/tension) is a wrong approach of what must be an universal toolchain.  
> I wrote `udk` to improve how webpack achieves watching compilation based on multi-configuration with dependencies between them.  
> I also wrote a [dev container](#dev-container) to won't have to write specific code for development purposes: allows hot reloading on webpack, client and server layers and no more issue to handle with the latest client's stats on the server side.  
> ...  
> I hope that `udk` can help developers simplify their toolchain.

[@enten](https://github.com/enten) to [@ctrl](https://github.com/ctrlplusb) – Oct 22, 2017

### How it works

* **It need a container configuration file**. Standard configuration names are: `udk.container.js`, `udk.config.js` and `udkfile.js`.
* That container configuration **can be empty or specify some options** to change or override the container behavior.
* If the option `hmr` is enabled (default behavior), *node* and *web* configurations are updated to inject entries and plugins needed for [HMR](https://webpack.js.org/concepts/hot-module-replacement/).
  * All configs: add plugins [`NoEmitOnErrorsPlugin`](https://webpack.js.org/plugins/no-emit-on-errors-plugin/) and [`HotModuleReplacementPlugin`](https://webpack.js.org/plugins/hot-module-replacement-plugin/)
  * *Node* configs: prepend entry [`webpack/hot/poll.js`](https://github.com/webpack/webpack/blob/master/hot/poll.js)
  * *Web* configs: prepend entry [`webpack-hot-middleware/client.js`](https://github.com/glenjamin/webpack-hot-middleware/blob/master/client.js)
* The container instantiates a compiler (based on webpack config file found along the container config file) and calls [`watch`](https://webpack.js.org/api/node/#watching).to starts watching.
* When a compilation is done the container requires *node* bundles (configurations which has `node` as target).
* *Node* bundles can be restarted at each compilation with the container option `autoRestart`.
* If a *node* bundle exports an [http server instance](https://nodejs.org/api/http.html#http_class_http_server), the container tries to decorate the request listener.
  * It uses [webpack-hot-middleware](https://github.com/glenjamin/webpack-hot-middleware) if option `hmr` is enabled.
  * It serves assets of *web* bundles according to their stats under the webpack config options [`output.publicPath`](https://webpack.js.org/configuration/output/#output-publicpath) (or `/` by default).
  * It injects stats of *web* bundles (in JSON format) in each request under `res.locals.webpackStats`.
* The container will be restarted when a metafile has changed (container config, webpack config and each metafiles specify in the container config option `metafiles`).

### Usage example

*If you don't need to override default options, you can leave container configuration file empty.*

*Note: the functions below are a simplified version of default ones.*

```shell
$ ./node_modules/.bin/udkc ./udk.container.js
```

```javascript
/** udk.container.js */

module.exports = {
  // __filename
  // __dirname

  autoRestart: false,
  bundleAvailableEvent: 'bundle-available',
  context: __dirname,
  hmr: {
    hotPollInterval: 1000,
    hotMiddleware: {
      path: '/__webpack_hmr'
    },
    hotMiddlewareClient: {
      overlay: true
    }
  },
  logger: console,
  metadirs: [

  ],
  metafiles: [
    'package.json',
  ],
  processTitle: 'udk-ctnr',
  stats: {

  },
  statsToJson: {
    source: false
  },
  statsToString: {
    colors: require('supports-color')
  },
  topModuleEntries: [
    /^source-map-support/
  ],
  watchOptions: {
    aggregateTimeout: 200
  },
  webpackConfig: 'webpack.config.js',

  // compiler,
  // compilerWatcher,

  bootstrap (proc, configPath) {
    this.logger.info('> bootstrap container')
  },
  injectWebpackStats (webpackStats, req, res) {
    res.locals = res.locals || Object.create(null)
    res.locals.webpackStats = Object.assign({}, res.locals.webpackStats, webpackStats)
  },
  onCompilerWatchClose () {
    this.logger.info('>>> compiler watch close')
  },
  onCompilerDone (stats) {
    this.logger.info('>>> compiler done')
  },
  onCompilerFailed (err) {
    this.logger.error('>>> compiler failed')
  },
  onCompilerInvalid (...args) {
    this.logger.info('>>> compiler invalid', args)
  },
  onCompilerWatching (err, stats) {
    this.logger.info('>>> compiler watching...')
  },
  onDown (event, ...args) {
    this.logger.info('>> container down', {event, args})
  },
  onUncaughtException (err) {
    this.logger.error('uncaught exception', err)
  },
  onUnhandledRejection (reason, promise) {
    this.logger.error('unhandled rejection', {reason, promise})
  },
  onUp (proc) {
    this.logger.info('>> container up')
  },
  prepareCompiler (compiler) {
    this.logger.info('>>> prepare webpack compiler')
  },
  prepareWebpackConfig () {
    this.logger.info('>>> prepare webpack config')
  },
  printCompilerError (err) {
    this.logger.error(err)
  },
  printCompilerStats (stats) {
    this.logger.info(this.stringifyCompilerStats(stats))
  },
  jsonifyCompilerStats (stats) {
    return stats.toJson(this.statsToJson)
  },
  stringifyCompilerStats (stats) {
    return stats.toString(this.statsToString)
  }
}
```

```javascript
/** webpack.config.js */

const webpack = require('webpack')
const {join} = require('path')
const {readdirSync} = require('fs')

const envName = process.env.NODE_ENV || 'development'
const isProd = process.env.NODE_ENV === 'production'
const isDev = !isProd

const context = __dirname
const nodeModulesDir = 'node_modules'

const devtool = isProd ? 'source-map' : 'eval'
const filename = isProd ? '[name].[chunkhash].js' : '[name].js'
const resolveExtensions = () => ['.js']

const clientEntry = join(context, 'client', 'index.js')
const clientOutputPath = join(context, 'build', 'client')
const clientPublicPath = '/client/'

const serverEntry = join(context, 'server', 'index.js')
const serverOutputPath = join(context, 'build', 'server')

function babelRule (options) {
  return Object.assign({
    test: /\.js$/,
    exclude: /node_modules/,
    use: 'babel-loader'
  }, options)
}

function compact (...args) {
  return [].concat(...args).filter((value) => value)
}

function getExternals (options = {}) {
  if (typeof options === 'string') {
    options = {context: options}
  }

  if (typeof options === 'function') {
    options = {filter: options}
  }

  if (typeof arguments[1] === 'function') {
    options = Object.assign({filter: arguments[1]}, options)
  }

  const context = options.context || process.cwd()
  const filter = options.filter || (() => true)
  const modulesDir = options.modulesDir || 'node_modules'
  const importType = options.importType || 'commonjs'

  return readdirSync(join(context, modulesDir))
    .filter(filter)
    .reduce((acc, mod) => {
      acc[mod] = [importType, mod].join(' ')

      return acc
    }, {})
}

const client = {
  name: 'client',
  target: 'web',
  context,
  devtool,
  entry: compact(
    isDev && [

    ],
    clientEntry
  ),
  output: {
    filename,
    chunkFilename: filename,
    path: clientOutputPath,
    publicPath: clientPublicPath
  },
  resolve: {
    extensions: resolveExtensions()
  },
  module: {
    rules: compact(
      babelRule({
        exclude: new RegExp(nodeModulesDir)
      })
    )
  },
  plugins: compact(
    isDev && [
      new webpack.NamedModulesPlugin()
    ],
    isProd && [
      new webpack.HashedModuleIdsPlugin(),
      new webpack.optimize.UglifyJsPlugin({
        compress: {screw_ie8: true, warnings: false},
        mangle: {screw_ie8: true},
        output: {screw_ie8: true, comments: false},
        sourceMap: true
      })
    ],
    new webpack.optimize.CommonsChunkPlugin({
      filename,
      minChunks: Infinity,
      names: ['bootstrap']
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(envName)
    })
  )
}

const server = {
  name: 'server',
  dependencies: [client.name],
  target: 'node',
  context,
  devtool,
  entry: compact(
    'source-map-support/register',
    serverEntry
  ),
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: serverOutputPath
  },
  resolve: {
    extensions: resolveExtensions()
  },
  module: {
    rules: compact(
      babelRule({
        exclude: new RegExp(nodeModulesDir)
      })
    )
  },
  externals: getExternals({
    context,
    modulesDir: nodeModulesDir,
    filter: (mod) => {
      switch (mod) {
        case '.bin':
        case 'source-map':
        case 'source-map-support':
          return false
      }

      return true
    }
  }),
  plugins: compact(
    isDev && [
      new webpack.NamedModulesPlugin()
    ],
    isProd && [
      new webpack.HashedModuleIdsPlugin()
    ],
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(envName)
    })
  )
}

module.exports = [
  client,
  server
]
```

```javascript
/** server/index.js */

const {createServer} = require('http')
let app = require('./app')

const server = createServer((req, res) => app(req, res))

server.listen(3000, () => console.log('Server listening -- http://localhost:3000'))

module.exports = server

if (module.hot) {
  module.hot.accept('./app.js', () => {
    app = require('./app.js')
  })
}
```

```javascript
/** server/app.js */

const express = require('express')

const app = express()

app.use((req, res) => {
  const {webpackStats} = res.locals

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
          ${JSON.stringify(webpackStats, null, 2)}
        </pre>
      </body>
    </html>
  `)
})

module.exports = app
```

## Node.js API

Same as [webpack's Node.js API](https://webpack.js.org/api/node/).

*The only difference is that udk accepts path to webpack config*

```javascript
udk(
  String|[String]|Object|[Object] options,
  Function callback?
) : Compiler?

// Examples
const udk = require('udk')

// udk(String configFilePath)
const compiler = udk(__dirname + '/webpack.config.js')

// udk([String] configFilePath)
const compiler = udk([
  __dirname + '/webpack.client.js',
  __dirname + '/webpack.server.js',
])

// udk(String configFilePath, Function callback)
udk(__dirname + '/webpack.config.js', (err, stats) => console.log({err, stats}))
```

```javascript
udk(
  String projectContext, String|[String] configFilePath,
  Function callback?
) : Compiler?

// Examples
const udk = require('udk')

// udk(String projectContext, String configFilePath)
const compiler = udk(__dirname, 'webpack.config.js')

// udk(String projectContext, [String] configFilePath)
const compiler = udk(__dirname, [
  'webpack.client.js',
  'webpack.server.js'
])

// udk(String projectContext, String configFilePath, Function callback)
udk(__dirname, 'webpack.config.js', (err, stats) => console.log({err, stats}))
```

### Compiler

#### run

```javascript
run(Function callback) : void

// Example
const udk = require('udk')

const compiler = udk(__dirname, 'webpack.config.js')

compiler.run((err, stats) => console.log({err, stats}))
```

#### watch

```javascript
watch(
  Object watchOptions,
  Function handler
) : Watching

// Example
const udk = require('udk')

const compiler = udk(__dirname, 'webpack.config.js')

const watching = compiler.watch(
  {aggregateTimeout: 200},
  (err, stats) => console.log({err, stats})
)
```

### Watching

#### close

```javascript
close(Function callback?) : void

// Example
const udk = require('udk')

const compiler = udk(__dirname, 'webpack.config.js')

const watching = compiler.watch(
  {aggregateTimeout: 200},
  (err, stats) => console.log({err, stats})
)

watching.close(() => console.log('Stop watching'))
```

## Implementation

### Files

* [webpack/bin/webpack.js](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/bin/webpack.js) `->` **[udk/bin/udk.js](https://github.com/enten/udk/blob/master/bin/udk.js)**
* [webpack/lib/MultiCompiler.js](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/MultiCompiler.js) `->` **[udk/lib/MultiCompiler.js](https://github.com/enten/udk/blob/master/lib/MultiCompiler.js)**
* [webpack/lib/webpack.js](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/webpack.js) `->` **[udk/lib/webpack.js](https://github.com/enten/udk/blob/master/lib/webpack.js)**
* `+` **[udk/bin/udkc.js](https://github.com/enten/udk/blob/master/bin/udkc.js)**
* `+` **[udk/lib/devContainer.js](https://github.com/enten/udk/blob/master/lib/devContainer.js)**
* `+` **[udk/lib/udk.js](https://github.com/enten/udk/blob/master/lib/udk.js)**
* `+` [udk/lib/util/Watchpack2.js](https://github.com/enten/udk/blob/master/lib/util/Watchpack2.js)
* `+` [udk/lib/util/WatchpackFork.js](https://github.com/enten/udk/blob/master/lib/util/WatchpackFork.js)
* `+` [udk/lib/util/bindExitHandler.js](https://github.com/enten/udk/blob/master/lib/util/bindExitHandler.js)
* `+` [udk/lib/util/container.js](https://github.com/enten/udk/blob/master/lib/util/container.js)
* `+` [udk/lib/util/debug.js](https://github.com/enten/udk/blob/master/lib/util/debug.js)
* `+` [udk/lib/util/decorateEventListener.js](https://github.com/enten/udk/blob/master/lib/util/decorateEventListener.js)
* `+` [udk/lib/util/ensureConfigHasEntry.js](https://github.com/enten/udk/blob/master/lib/util/ensureConfigHasEntry.js)
* `+` [udk/lib/util/ensureConfigHasPlugin.js](https://github.com/enten/udk/blob/master/lib/util/ensureConfigHasPlugin.js)
* `+` [udk/lib/util/findForTarget.js](https://github.com/enten/udk/blob/master/lib/util/findForTarget.js)
* `+` [udk/lib/util/getEntryOutputPathFromStats.js](https://github.com/enten/udk/blob/master/lib/util/getEntryOutputPathFromStats.js)
* `+` [udk/lib/util/getOutputPublicPath.js](https://github.com/enten/udk/blob/master/lib/util/getOutputPublicPath.js)
* `+` [udk/lib/util/moduleExists.js](https://github.com/enten/udk/blob/master/lib/util/moduleExists.js)
* `+` [udk/lib/util/requireDefault.js](https://github.com/enten/udk/blob/master/lib/util/requireDefault.js)
* `+` [udk/lib/util/resolveWith.js](https://github.com/enten/udk/blob/master/lib/util/resolveWith.js)

### Class diagram

```
┌┄ tapable ┄┄┄┄┄┄┄┄┄┄┄┄┄┐
┆ ┌───────────────────┐ ┆
┆ |      Tapable      |<════════════╗
┆ └─────────Λ─────────┘ ┆           ║
└┄┄┄┄┄┄┄┄┄┄┄║┄┄┄┄┄┄┄┄┄┄┄┘           ║
            ║                       ║
┌┄ webpack ┄║┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄║┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐
┆ ┌─────────╨─────────┐   ┌─────────╨─────────┐   ┌───────────────────┐ ┆
┆ |   MultiCompiler   ├──>|     Compiler      ├──>|     Watching      | ┆
┆ └─────────Λ─────────┘   └─────────Λ─────────┘   └───────────────────┘ ┆
└┄┄┄┄┄┄┄┄┄┄┄║┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
            ║                       │
┌┄ udk ┄┄┄┄┄║┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐
┆ ┌─────────╨─────────┐   ┌─────────┴─────────┐   ┌───────────────────┐ ┆
┆ |   MultiCompiler   |<──┤   DevContainer    ╞══>|     Container     | ┆
┆ └───────────────────┘   └───────────────────┘   └───────────────────┘ ┆
└┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘

┄┄┄┄ package
──── module
═══> extend relation
───> 0..n relation
```

* [tapable/lib/Tapable](https://github.com/webpack/tapable/blob/df6f2aff44ea06a00000a3a34db2174582597457/lib/Tapable.js)
* **[udk/lib/MultiCompiler](https://github.com/enten/udk/blob/1bea885e7079f0e94bceacca1f75607c4e93a8ee/lib/MultiCompiler.js)**
* **[udk/lib/devContainer](https://github.com/enten/udk/blob/1bea885e7079f0e94bceacca1f75607c4e93a8ee/lib/devContainer.js#L31)**
* **[udk/lib/util/container](https://github.com/enten/udk/blob/1bea885e7079f0e94bceacca1f75607c4e93a8ee/lib/util/container.js)**
* [webpack/lib/Compiler](https://github.com/enten/udk/blob/0d5d7da79b4146c1508302b2f6d0e01f0aedb5f2/lib/Compiler.js#L133)
* [webpack/lib/MultiCompiler](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/MultiCompiler.js)
* [webpack/lib/Watching](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/Compiler.js#L17)

## License

[MIT](./LICENSE)
