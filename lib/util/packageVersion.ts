// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as path from 'path';

export interface PackageVersion {
  name: string;
  nums: [ number, number, number ];
  major: number;
  minor: number;
  patch: number;
}

export function packageVersion(pkgName: string): PackageVersion {
  const pkgJsonPath = path.join(pkgName, 'package.json');
  const pkgJson = require(pkgJsonPath);

  const name = pkgJson.version || '';
  const nums = (name || '..').split('.').map((x: string) => +x) as [ number, number, number ];

  return {
    name,
    nums,
    major: nums[0],
    minor: nums[1],
    patch: nums[2],
  };
}
