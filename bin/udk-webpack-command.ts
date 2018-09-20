// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import {
  aliasModuleResolveFilename,
  enableModuleResolveFilenameHook,
} from '../lib/util/hookResolveFilename';

enableModuleResolveFilenameHook();

aliasModuleResolveFilename({
  fromFile: 'webpack-command/lib/compiler',
  replaceRequest: 'webpack',
  withRequest: 'udk/lib/webpack',
});

// tslint:disable-next-line:no-implicit-dependencies
require('webpack-command/lib/cli');
