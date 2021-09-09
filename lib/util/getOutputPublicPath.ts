// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

export type GetOutputPublicPathInput = { compilation: webpack.Compilation }
  | webpack.Compilation
  | webpack.Compiler
  | webpack.Configuration
  // | webpack.Output
  | string
  | null
  | undefined;

export interface GetOutputPublicPathOptions {
  endsSlash?: boolean;
  pathOnly?: boolean;
  startsSlash?: boolean;
}

export const GET_OUTPUT_PUBLIC_PATH_OPTIONS_DEFAULT: GetOutputPublicPathOptions = {
  endsSlash: false,
  pathOnly: true,
  startsSlash: true,
};

const URL_BASE_REGEX = /(^\w+:|^)\/\/([^\/]*)/;

export function getOutputPublicPath(
  obj: GetOutputPublicPathInput,
  options?: GetOutputPublicPathOptions,
) {
  options = { ...GET_OUTPUT_PUBLIC_PATH_OPTIONS_DEFAULT, ...options };

  let publicPath: string|null = null;

  // reduce from highest potential object to webpack config options output
  if (obj && typeof obj === 'object') {
    // WebpackStats
    if ('compilation' in obj && obj.compilation) {
      obj = obj.compilation;
    }

    // WebpackCompilation
    if ('compiler' in obj && obj.compiler) {
      obj = obj.compiler;
    }

    // WebpackCompiler
    if ('options' in obj && obj.options) {
      obj = obj.options as any;
    }

    // WebpackConfigOptionsOutput
    if ('output' in (obj as any) && (obj as any).output) {
      obj = (obj as any).output;
    }

    // WebpackConfigOptionsOutput
    if ('publicPath' in (obj as any) && (obj as any).publicPath) {
      obj = (obj as any).publicPath;
    }
  }

  if (typeof obj === 'string') {
    publicPath = obj;
  }

  if (!publicPath) {
    publicPath = '/';
  }

  if (publicPath !== '/') {
    if (options.pathOnly) {
      publicPath = publicPath.replace(URL_BASE_REGEX, '');
    }

    if (!URL_BASE_REGEX.test(publicPath)) {
      if (options.startsSlash && !publicPath.startsWith('/')) {
        publicPath = '/' + publicPath;
      }

      if (!options.startsSlash) {
        while (publicPath.startsWith('/')) {
          publicPath = publicPath.substring(1);
        }
      }
    }

    if (options.endsSlash && !publicPath.endsWith('/')) {
      publicPath = publicPath + '/';
    }

    if (!options.endsSlash && publicPath !== '/') {
      while (publicPath.endsWith('/')) {
        publicPath = publicPath.substring(0, publicPath.length - 1);
      }
    }
  }

  if (publicPath === '/' && !options.endsSlash && !options.startsSlash) {
    publicPath = '';
  }

  return publicPath;
}
