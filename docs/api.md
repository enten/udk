## Node.js API

Same as [webpack's Node.js API](https://webpack.js.org/api/node/).

```javascript
// udk(options, callback?): ICompiler | IWatcher?;

const udk = require('udk');

const multiConfig = [
  { name: 'client' },
  { name: 'server', dependencies: [ 'client' ] }
];

udk(multiConfig, (err, stats) => console.log(err || stats.toString()));
```

### Compiler

#### run

```javascript
// run(callback: (err: Error | null, stats: webpack.Stats) => void): void
const udk = require('udk');

const multiConfig = [
  { name: 'client' },
  { name: 'server', dependencies: [ 'client' ] }
];

const compiler = udk(multiConfig);

compiler.run((err, stats) => console.log(err || stats.toString()))
```

#### watch

```javascript
// watch(
//   options: webpack.WatchOptions,
//   handler: (err: Error | null, stats: webpack.Stats) => void
// ): webpack.Watching

const udk = require('udk');

const multiConfig = [
  { name: 'client' },
  { name: 'server', dependencies: [ 'client' ] }
];

const compiler = udk(multiConfig);

const watching = compiler.watch(
  { aggregateTimeout: 200 },
  (err, stats) => console.log(err || stats.toString())
);
```

### Watching

#### close

```javascript
// close(callback?: () => void) : void

const udk = require('udk');

const multiConfig = [
  { name: 'client' },
  { name: 'server', dependencies: [ 'client' ] },
];

const compiler = udk(multiConfig);

const watching = compiler.watch(
  { aggregateTimeout: 200 },
  (err, stats) => console.log(err || stats.toString())
);

watching.close(() => console.log('Stop watching'));
```
