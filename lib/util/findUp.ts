// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';

export function findUp(names: string | string[], from: string): string | null {
  if (!Array.isArray(names)) {
    names = [ names ];
  }

  const root = path.parse(from).root;
  let currentDir = from;

  while (currentDir && currentDir !== root) {
    for (const name of names) {
      const p = path.join(currentDir, name);

      if (fs.existsSync(p)) {
        return p;
      }
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}
