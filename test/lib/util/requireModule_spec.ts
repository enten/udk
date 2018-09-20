// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { requireModule } from '../../../lib/util/requireModule';

describe('udk/lib/util/requireModule', () => {
  describe('requireModule', () => {
    const pkgPath = require.resolve('../../../package');
    const pkg = require('../../../package');

    it('should return all module if not contains default key', () => {
      expect(requireModule(pkgPath)).toEqual(pkg);

      pkg.default = { foo: 'bar' };

      expect(requireModule(pkgPath)).toEqual({ foo: 'bar' });
      expect(requireModule(pkgPath, { default: false })).toEqual(pkg);
      expect(requireModule(pkgPath, { default: 'name' })).toEqual(pkg.name);
    });

    it('should handle option cache', () => {
      pkg.default = { foo: 'bar' };

      expect(requireModule(pkgPath, { cache: true, default: false }).default)
        .toEqual({ foo: 'bar' });
      // expect(requireModule(pkgPath, { cache: false, default: false }).default)
      //   .toBeUndefined();
    });
  });
});
