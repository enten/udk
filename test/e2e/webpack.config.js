/** webpack.config.js */

const { join } = require('path');
const { basename } = require('path');
const { readdirSync } = require('fs');
const webpack = require('webpack');

const NODE_MODULES = join(__dirname, '..', '..', 'node_modules');

const envName = process.env.NODE_ENV || 'development';
const isProd = process.env.NODE_ENV === 'production';
const isDev = !isProd;

const context = __dirname;
const nodeModulesDir = 'node_modules';

const devtool = isProd ? 'source-map' : 'eval-source-map';
const filename = isProd ? '[name].[chunkhash].js' : '[name].js';
const resolveExtensions = () => ['.js'];

const clientEntry = join(context, 'src', 'client.js');
const clientOutputPath = join(context, 'dist', 'client');
const clientPublicPath = '/client/';

const serverEntry = join(context, 'src', 'server.js');
const serverOutputPath = join(context, 'dist', 'server');

const compact = (...args) => [].concat(...args).filter((value) => value);

const getExternals = (options = {}) => {
  if (typeof options === 'string') {
    options = { context: options };
  }

  if (typeof options === 'function') {
    options = { filter: options };
  }

  if (typeof arguments[1] === 'function') {
    options = Object.assign({ filter: arguments[1] }, options);
  }

  const context = options.context || process.cwd();
  const filter = options.filter || (() => true);
  const modulesDir = options.modulesDir || 'node_modules';
  const importType = options.importType || 'commonjs';

  return readdirSync(NODE_MODULES)
    .filter(filter)
    .reduce((acc, mod) => {
      acc[mod] = [importType, mod].join(' ');

      return acc;
    }, {});
};

const client = {
  // mode: envName,
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
    publicPath: clientPublicPath,
  },
  resolve: {
    extensions: resolveExtensions(),
    modules: [ NODE_MODULES ],
  },
  plugins: compact(
    isDev && [
      new webpack.NamedModulesPlugin(),
    ],
    isProd && [
      new webpack.HashedModuleIdsPlugin(),
    ],
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(envName)
    })
  ),
};

const server = {
  // mode: envName,
  name: 'server',
  dependencies: [ client.name ],
  target: 'node',
  node: false,
  context,
  devtool,
  entry: compact(
    // 'source-map-support/register',
    serverEntry
  ),
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: serverOutputPath,
  },
  resolve: {
    extensions: resolveExtensions(),
    modules: [ NODE_MODULES ],
  },
  externals: getExternals({
    context: basename(NODE_MODULES),
    modulesDir: nodeModulesDir,
    filter: (mod) => {
      switch (mod) {
        case '.bin':
        case 'source-map':
        case 'source-map-support':
          return false;
      }

      return true;
    },
  }),
  plugins: compact(
    isDev && [
      new webpack.NamedModulesPlugin(),
    ],
    isProd && [
      new webpack.HashedModuleIdsPlugin(),
    ],
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(envName),
    })
  ),
};

// module.exports = client;
module.exports = [
  client,
  server,
];
