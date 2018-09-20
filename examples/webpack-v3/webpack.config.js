// webpack.config.js

const webpack = require('webpack');

const client = {
  name: 'client',
  target: 'web',
  entry: './src/client.js',
  output: {
    path: __dirname + '/dist/client',
    filename: 'main.js',
  },
  plugins: [
    new webpack.NamedModulesPlugin()
  ]
};

const server = {
  name: 'server',
  target: 'node',
  dependencies: [ client.name ], // server depends on client
  entry: './src/server.js',
  node: {
    __filename: false,
    __dirname: false
  },
  output: {
    path: __dirname + '/dist/server',
    filename: 'main.js',
    libraryTarget: 'commonjs2',
  },
  plugins: [
    new webpack.NamedModulesPlugin()
  ]
};

module.exports = [ client, server ]; // webpack multi config
