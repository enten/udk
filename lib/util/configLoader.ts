// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

import { aliasModuleResolveFilename, enableModuleResolveFilenameHook } from './hookResolveFilename';
import { packageVersion } from './packageVersion';

export interface ConfigLoaderOptions {
  allowMissing?: boolean;
  configPath?: string;
  cwd?: string;
  require?: string | string[];
  schema?: any; // tslint:disable-line:no-any
}

export interface ConfigLoaderResult {
  config: webpack.Configuration;
  configPath: string | undefined;
}

// compat: fix schema path for webpack v3
if (packageVersion('webpack').major < 4) {
  enableModuleResolveFilenameHook();

  aliasModuleResolveFilename({
    fromFile: '@webpack-contrib/config-loader/lib/index',
    replaceRequest: 'webpack/schemas/WebpackOptions.json',
    withRequest: 'webpack/schemas/webpackOptionsSchema.json',
  });
}

export const configLoader = (options?: ConfigLoaderOptions) => {
  return require('@webpack-contrib/config-loader')(options) as Promise<ConfigLoaderResult>;
};
