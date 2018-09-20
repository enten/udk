// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { existsModule } from '../../../lib/util/existsModule';

describe('udk/lib/util/existsModule', () => {
  describe('existsModule', () => {
    it('should return true if module exists', () => {
      expect(existsModule(__dirname + '/../../../package')).toBeTruthy();
    });

    it('should return false if module does not exists', () => {
      expect(existsModule(__dirname + '/../../../package2')).toBeFalsy();
    });

    it('should throw when error has not code MODULE_NOT_FOUND', () => {
      expect(() => existsModule({} as string)).toThrowError();
    });
  });
});
