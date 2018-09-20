// webpack.config.ts

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

export = [ client, server ]; // webpack multi config
