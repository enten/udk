// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { packageVersion } from '../../../lib/util/packageVersion';

describe('udk/lib/util/packageVersion', () => {
  describe('packageVersion', () => {
    it('should parse version name into object', () => {
      const pkg: { version: string } = require('../../../package');
      const pkgVersionNums = pkg.version.split('.').map(x => +x);

      expect(packageVersion(__dirname + '/../../..')).toEqual({
        name: pkg.version,
        nums: pkgVersionNums,
        major: pkgVersionNums[0],
        minor: pkgVersionNums[1],
        patch: pkgVersionNums[2],
      });
    });

    it('should works even if version field does not exist', () => {
      const pkg: { version: string } = require('../../../package');
      const originVersion = pkg.version;

      delete pkg.version;

      expect(packageVersion(__dirname + '/../../..')).toEqual({
        name: '',
        nums: [ 0, 0, 0 ],
        major: 0,
        minor: 0,
        patch: 0,
      });

      pkg.version = originVersion;
    });
  });
});
