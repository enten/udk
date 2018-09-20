# Universal Development Kit

> Webpack extension which improves universal application development.

[![NPM Version](https://img.shields.io/npm/v/udk.svg)](https://npmjs.com/package/udk)
[![NPM Dependencies](https://img.shields.io/david/enten/udk.svg)](https://david-dm.org/enten/udk)
[![Build Status](https://travis-ci.org/enten/udk.svg?branch=master)](https://travis-ci.org/enten/udk)
[![Coverage Status](https://coveralls.io/repos/github/enten/udk/badge.svg)](https://coveralls.io/github/enten/udk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

* Starts universal application development fastly (from scratch/without boilerplate)
* Designed on webpack's standard API [v3](https://github.com/webpack/webpack/tree/v3.11.0) and [v4](https://github.com/webpack/webpack/tree/v4.4.1)
* Enhances compilers dependencies: sequential compilation according to dependency graph
* Support [webpack-cli](https://github.com/webpack/webpack-cli/) and [webpack-command](https://github.com/webpack-contrib/webpack-command/)<sup>new</sup>
* **[Dev container](#dev-container) to increase developer productivity**: don't write specific code for development purposes anymore
* [Compatible with Typescript](./examples/typescript/) and [Universal Angular Application](./angular)<sup>new</sup>

## Install

```shell
npm install --save-dev udk webpack
```

## The Gist

```js
// webpack.config.js

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

const client = {
  name: 'client',
  entry: './src/client.js',
  output: {
    path: __dirname + '/dist',
    filename: 'client.js'
  }
};

const server = {
  name: 'server',
  dependencies: [ client.name ], // server depends on client
  entry: './src/server.js',
  output: {
    path: __dirname + '/dist',
    filename: 'server.js'
  }
};

module.exports = [ client, server ]; // webpack multi config
```

```js
// src/client.js

import './shared';

console.log('Hello, client');
```

```js
// src/server.js

import './shared';

console.log('Hello, server');
```

```js
// src/shared.js

console.log('Hello, shared');
```

```shell
DEBUG=udk:* npx udk --config webpack.config.js --watch
```

Now, try to update each file and check the output:

1. update `client.js` to check that server compiler will be invalidate when client compiler done ;
2. update `server.js` to check that sever compiler will be the only one compiler invalided ;
3. update `shared.js` to check that server compiler will wait client compiler done before compile too ;
4. update `shared.js` with a syntax error to check that server won't compile because client compiler has error ;
5. update `shared.js` to fix syntax error and check client and server compilers will run in serie.

Run `webpack --config webpack.config.js --watch` and try the same updates to check the difference between webpack and udk multi compiler behavior.

Under the hood, [udk extends MultiCompiler only](./lib/MultiCompiler.ts) to ensure some behaviors:

* Invalidate compiler dependants when a compiler done ;
* Interupt compilation if a compiler dependency has stats errors ;
* Wait compiler dependency done when a shared file are updated.

## Command Line Interface

### udk.js

Same as [webpack CLI](https://webpack.js.org/api/cli/).

### [Usage with config file](https://webpack.js.org/api/cli/#usage-with-config-file)

```shell
udk [--config webpack.config.js]
```

### [Usage without config file](https://webpack.js.org/api/cli/#usage-without-config-file)

```shell
udk <entry> [<entry>] <output>
```

All webpack CLIs are supported:

* [webpack-cli](https://github.com/webpack/webpack-cli) (v4) ;
* [webpack-command](https://github.com/webpack-contrib/webpack-command) (v4) ;
* [webpack/cli](https://github.com/webpack/webpack/tree/v3.0.0/bin) (v3).

## Node.js API

See [docs/api.md](./docs/api.md).

## FAQ

See [docs/faq.md](./docs/faq.md).

## DevContainer

See [docs/dev-container.md](./docs/dev-container.md).

## Implementation

See [docs/implementation.md](./docs/implementation.md).

## License

[MIT](./LICENSE)
