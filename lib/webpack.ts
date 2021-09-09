// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { packageVersion } from './util/packageVersion';

import { WebpackAPI } from './webpack-api';

let webpack: WebpackAPI;

if (packageVersion('webpack').major > 4) {
  webpack = require('./webpack.v5');
} else if (packageVersion('webpack').major > 3) {
  webpack = require('./webpack.v4');
} else {
  webpack = require('./webpack.v3');
}

export = webpack;
