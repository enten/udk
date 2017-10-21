# Universal Development Kit

> Webpack extension which improves universal application development.

:warning: Still in its poc phase

* Starts universal application development fastly (from scratch/without boilerplate)
* Designed on webpack's standard API
* Enhances compilers dependencies: sequential compilation according to dependency graph
* Enhances CLI watching: restarts watching process when webpack config changes
* [Dev container](#dev-container) to inject client's stats into server's requests, to serve client's assets and to enable [HMR](https://webpack.js.org/concepts/hot-module-replacement/) on client and server sides

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
  dependencies: ['client'],
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

*The only difference is that [udk watches on config files and restarts the process if a change occurred](https://github.com/enten/udk/blob/0d5d7da79b4146c1508302b2f6d0e01f0aedb5f2/bin/udk.js#L269).*

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
$ udkc [container config path]
```

## Dev Container

A dev container fork a child process which will perform some operations to increase developper productivity when he deals with universal application (using webpack to create two bundles at once: web and server bundles).

* It need a container configuration file (standard configuration names are `udk.container.js`, `udk.config.js` or `udkfile.js`) ;
* That container configuration can be empty or can specify some options and functions to change or override the child process behavior ;
* If the option `hmr` is enabled (default behavior), client and server configurations will be update to inject entries and plugins needed for [HMR](https://webpack.js.org/concepts/hot-module-replacement/):
  * Client's config: prepend entry [`webpack-hot-middleware/client.js`](https://github.com/glenjamin/webpack-hot-middleware/blob/master/client.js) and add webpack's plugins `HotModuleReplacementPlugin` and `NoEmitOnErrorsPlugin` ;
  * Client's config: prepend entry [`webpack/hot/poll.js`](https://github.com/webpack/webpack/blob/master/hot/poll.js) and add webpack's plugins `HotModuleReplacementPlugin` and `NoEmitOnErrorsPlugin` ;
* The child process instantiates a compiler (based on webpack config file found along the container config file) and executes its `watch` method ;
* When a compilation is done the child process will require the server bundle (which has `node` as target) ;
* The server bundle can be restarted at each compilation with the container option `serverAutoRestart` ;
* If the server bundle exports an http server instance, the child process will try to decorate the request handler:
  * It serves client's assets according to its stats under the webpack config options [`output.publicPath`](https://webpack.js.org/configuration/output/#output-publicpath) (or "/" by default) ;
  * It uses [webpack-hot-middleware](https://github.com/glenjamin/webpack-hot-middleware) if option `hmr` is enabled ;
  * It injects the client stats (in JSON format) in each request under `res.locals.webpackClientStats` ;
* If the server bundle exports an http server instance, the child process will try to decorate 
* If option `hmr` is enable and the server bundle exports an http server instance, 
* The container will restart the child process when a metafile has changed (container config, webpack config and each metafiles specify in the container config under the option `metafiles`).

### Usage example

*If you don't need to override default options and functions of the dev container, you can leave container configuration file empty.*

*Note: the functions below are a simplified version of real ones*

```shell
$ ./node_modules/.bin/udkc ./udk.container.js
```

```javascript
/** udk.container.js */

const logger = console

module.exports = {
  options: {
    // note: values below are set by default
    context: process.cwd(),
    hmr: {
      hotPollInterval: 1000, // option used for server entry webpack/hot/poll.js?${hotPollInterval}
      hotMiddleware: { // same as webpack-hot-middleware's options
        path: '/__webpack_hmr'
      },
      hotMiddlewareClient: { // same as webpack-hot-middleware's client options
        
      },
      plugin: { // same as webpack's HotModuleReplacementPlugin options

      }
    },
    metafiles: [],
    serverAutoRestart: false,
    serverEntry: 'main',
    stats: { // same as webpack's stats options
      colors: true,
      source: false
    },
    watch: { // same as webpack's watch options
      aggregateTimeout: 200
    },
    webpackConfig: 'webpack.config.js'
  },
  logger,
  // functions below are called in container process
  onRestart: () => {
    logger.info('> restart container')
  },
  setupWatcher: (watcher) => {
    watcher.on('aggregated', () => {
      logger.info('> metafile changes aggregated')
    })
  },
  // functions below are called in child process
  decorateServer: (httpServer, multiCompiler) => {
    const serverEvents = httpServer && httpSserver._events
    const requestHandler = serverEvents && serverEvents.request

    if (requestHandler && getRequestDecorator) {
      httpServer._events.request = module.exports.requestDecorator(requestHandler)
    }
  },
  requestDecorator: (requestHandler) => {
    return (req, res) => {
      if (webpackClientStats) {
        res.locals = res.locals || Object.create(null)
        res.locals.webpackClientStats = webpackClientStats
      }

      requestHandler(req, res)
    }
  },
  setupCompiler: (compiler) => {
    compiler.plugin('done', (stats) => {
      logger.info('>>> compilation done!')
    })

    compiler.plugin('failed', () => {
      logger.error('>>> compilation failed!')
    })

    compiler.plugin('invalid', () => {
      logger.info('>>> file changed')
    })

    compiler.plugin('watch-close', () => {
      logger.info('>>> stop watching')
    })
  },
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

const context = process.cwd()
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
  dependencies: ['client'],
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
  const {webpackClientStats} = res.locals

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
          ${JSON.stringify(webpackClientStats, null, 2)}
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

* `+` [udk/bin/udkc.js](https://github.com/enten/udk/blob/master/bin/udkc.js)
* `+` [udk/lib/devContainer.js](https://github.com/enten/udk/blob/master/lib/devContainer.js)
* `+` [udk/lib/udk.js](https://github.com/enten/udk/blob/master/lib/udk.js)
* `+` [udk/lib/util/Watchpack2.js](https://github.com/enten/udk/blob/master/lib/util/Watchpack2.js)
* `+` [udk/lib/util/WatchpackFork.js](https://github.com/enten/udk/blob/master/lib/util/WatchpackFork.js)
* `+` [udk/lib/util/debug.js](https://github.com/enten/udk/blob/master/lib/util/debug.js)
* `+` [udk/lib/util/moduleExists.js](https://github.com/enten/udk/blob/master/lib/util/moduleExists.js)
* `+` [udk/lib/util/runSeries.js](https://github.com/enten/udk/blob/master/lib/util/runSeries.js)
* [webpack/bin/webpack.js](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/bin/webpack.js) `->` [udk/bin/udk.js](https://github.com/enten/udk/blob/master/bin/udk.js)
* [webpack/lib/Compiler.js](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/Compiler.js) `->` [udk/lib/Compiler.js](https://github.com/enten/udk/blob/master/lib/Compiler.js)
* [webpack/lib/MultiCompiler.js](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/MultiCompiler.js) `->` [udk/lib/MultiCompiler.js](https://github.com/enten/udk/blob/master/lib/MultiCompiler.js)
* [webpack/lib/webpack.js](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/webpack.js) `->` [udk/lib/webpack.js](https://github.com/enten/udk/blob/master/lib/webpack.js)

### Class diagram

```
.. tapable ................
: +---------------------+ :
: |       Tapable       |<-------------+
: +---------------------+ :            |
.............^.............            |
             |                         |
.. webpack ..|.........................|...................................
: +---------------------+   +-------------------+   +-------------------+ :
: |    MultiCompiler    |==>|     Compiler      |==>|     Watching      | :
: +---------------------+   +-------------------+   +-------------------+ :
.............^........................^.......................^............
             |                        |                       |
.. udk ......|........................|.......................|............
: +---------------------+   +-------------------+   +-------------------+ :
: |    MultiCompiler    |==>|     Compiler      |==>|     Watching      | :
: +---------------------+   +-------------------+   +-------------------+ :
:            ^                                                            :
:            |                                                            :
: +---------------------+                                                 :
: |    DevContainer     |                                                 :
: +---------------------+                                                 :
...........................................................................
```

* [tapable/lib/Tapable](https://github.com/webpack/tapable/blob/df6f2aff44ea06a00000a3a34db2174582597457/lib/Tapable.js)
* [udk/lib/Compiler](https://github.com/enten/udk/blob/e8ff9e6cecf7432b0a6e00ec0d206277e946381d/lib/Compiler.js#L128)
* [udk/lib/Compiler.Watching](https://github.com/enten/udk/blob/0d5d7da79b4146c1508302b2f6d0e01f0aedb5f2/lib/Compiler.js#L44)
* [udk/lib/devContainer](https://github.com/enten/udk/blob/d211ebdd165c83882f1a8845701b9ad5eecca218/lib/devContainer.js#L26)
* [udk/lib/MultiCompiler](https://github.com/enten/udk/blob/0d5d7da79b4146c1508302b2f6d0e01f0aedb5f2/lib/MultiCompiler.js)
* [webpack/lib/Compiler](https://github.com/enten/udk/blob/0d5d7da79b4146c1508302b2f6d0e01f0aedb5f2/lib/Compiler.js#L133)
* [webpack/lib/MultiCompiler](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/MultiCompiler.js)
* [webpack/lib/Watching](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/Compiler.js#L17)
