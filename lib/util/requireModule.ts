// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

export interface RequireModuleOptions {
  cache?: boolean;
  default?: boolean | string;
}

export function requireModule<T = NodeJS.Module['exports']>(
  id: string,
  options?: RequireModuleOptions,
): T {
  options = { cache: true, default: true, ...options };
  id = require.resolve(id);

  /* istanbul ignore next */
  if (!options.cache && require.cache[id]) {
    delete require.cache[id];
  }

  const mod = require(id);

  if (options.default) {
    const defaultKey = typeof options.default === 'string' ? options.default : 'default';

    return mod[defaultKey] || mod;
  }

  return mod;
}
