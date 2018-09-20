// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import {
  aliasModuleResolveFilename,
  enableModuleResolveFilenameHook,
} from '../lib/util/hookResolveFilename';

enableModuleResolveFilenameHook();

aliasModuleResolveFilename({
  fromFile: 'webpack/bin/webpack',
  replaceRequest: '../lib/webpack.js',
  withRequest: 'udk/lib/webpack',
});

require('webpack/bin/webpack');
