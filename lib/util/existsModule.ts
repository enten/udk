// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

export function existsModule(id: string): string | undefined {
  let result: string | undefined;

  try {
    result = require.resolve(id);
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
  }

  return result;
}
