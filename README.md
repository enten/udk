# Universal Development Kit

> Webpack extension which improves universal application development.

:warning: Still in its poc phase

* Starts universal application development fastly (from scratch/without boilerplate)
* Designed on webpack's standard API
* Enhances compilers dependencies: sequential compilation according to dependency graph
* Enhances CLI watching: restarts watching process when webpack config changes

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

## Command Line Interface (CLI)

Same as [webpack's CLI](https://webpack.js.org/api/cli/).

*The only difference is that [udk watches on config files and restarts the process if a change occurred](https://github.com/enten/udk/blob/75ca9cc7d20e001d75daeb82698c311b8a462645/bin/udk.js#L274).*

### [Usage with config file](https://webpack.js.org/api/cli/#usage-with-config-file)

```shell
udk [--config webpack.config.js]
```

### [Usage without config file](https://webpack.js.org/api/cli/#usage-without-config-file)

```shell
udk <entry> [<entry>] <output>
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

const compiler = udk(__dirname + '/webpack.config.js')

const compiler = udk([
  __dirname + '/webpack.client.js',
  __dirname + '/webpack.server.js',
])

udk(__dirname + '/webpack.config.js', (err, stats) => console.log({err, stats}))
```

```javascript
udk(
  String projectContext, String|[String] configFilePath,
  Function callback?
) : Compiler?

// Examples
const udk = require('udk')

const compiler = udk(__dirname, 'webpack.config.js')

const compiler = udk(__dirname, [
  'webpack.client.js',
  'webpack.server.js'
])

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

### Overriding

* `+` [udk/lib/udk.js](https://github.com/enten/udk/blob/master/lib/udk.js)
* `+` [udk/lib/utilWatchpack2.js](https://github.com/enten/udk/blob/master/lib/util/Watchpack2.js)
* `+` [udk/lib/utilWatchpackFork.js](https://github.com/enten/udk/blob/master/lib/util/WatchpackFork.js)
* `+` [udk/lib/utildebug.js](https://github.com/enten/udk/blob/master/lib/util/debug.js)
* `+` [udk/lib/utilrunSeries.js](https://github.com/enten/udk/blob/master/lib/util/runSeries.js)
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
...........................................................................
```

* [tapable/lib/Tapable](https://github.com/webpack/tapable/blob/df6f2aff44ea06a00000a3a34db2174582597457/lib/Tapable.js)
* [udk/lib/Compiler](https://github.com/enten/udk/blob/e8ff9e6cecf7432b0a6e00ec0d206277e946381d/lib/Compiler.js#L128)
* [udk/lib/MultiCompiler](https://github.com/enten/udk/blob/e8ff9e6cecf7432b0a6e00ec0d206277e946381d/lib/MultiCompiler.js)
* [udk/lib/Watching](https://github.com/enten/udk/blob/e8ff9e6cecf7432b0a6e00ec0d206277e946381d/lib/Compiler.js#L44)
* [webpack/lib/Compiler](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/Compiler.js#L170)
* [webpack/lib/MultiCompiler](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/MultiCompiler.js)
* [webpack/lib/Watching](https://github.com/webpack/webpack/blob/f6285d22171f962cd0abd9bd51b1ab449d704d26/lib/Compiler.js#L17)
