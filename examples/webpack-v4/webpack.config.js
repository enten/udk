// webpack.config.js

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

const client = {
  mode,
  name: 'client',
  target: 'web',
  entry: './src/client.js',
  output: {
    path: __dirname + '/dist/client',
    filename: 'main.js',
  }
};

const server = {
  mode,
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
  }
};

module.exports = [ client, server ]; // webpack multi config
