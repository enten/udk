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

## Node.js API

```javascript
udk(
  String|[String]|Object|[Object] options,
  Function callback?
) : UDK Compiler?

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
) : UDK Compiler?

// Examples
const udk = require('udk')

const compiler = udk(__dirname, 'webpack.config.js')

const compiler = udk(__dirname, [
  'webpack.client.js',
  'webpack.server.js'
])

udk(__dirname, 'webpack.config.js', (err, stats) => console.log({err, stats}))
```

### UDK Compiler

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
) : Compiler Watching

// Example
const udk = require('udk')

const compiler = udk(__dirname, 'webpack.config.js')

const watching = compiler.watch(
  {aggregateTimeout: 200},
  (err, stats) => console.log({err, stats})
)
```

### UDK Compiler Watching

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
* `+` [udk/lib/utilWatchpackCompiler.js](https://github.com/enten/udk/blob/master/lib/util/WatchpackCompiler.js)
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
