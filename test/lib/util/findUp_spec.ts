// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';

import { findUp } from '../../../lib/util/findUp';

jest.mock('fs', () => ({
  existsSync: jest.fn((p: string) => p === require('path').normalize('/a/bar')),
}));

describe('udk/lib/util/findUp', () => {
  describe('findUp', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return null if file name is not found', () => {
      expect(findUp('foo', '/a/b/c')).toBeNull();
    });

    it('should return true when file name is found', () => {
      expect(findUp([
        'foo',
        'bar',
      ], path.normalize('/a/b/c'))).toBe('/a/bar');
      expect(fs.existsSync).toBeCalledTimes(6);
      expect(fs.existsSync).toHaveBeenNthCalledWith(1, '/a/b/c/foo');
      expect(fs.existsSync).toHaveBeenNthCalledWith(2, '/a/b/c/bar');
      expect(fs.existsSync).toHaveBeenNthCalledWith(3, '/a/b/foo');
      expect(fs.existsSync).toHaveBeenNthCalledWith(4, '/a/b/bar');
      expect(fs.existsSync).toHaveBeenNthCalledWith(5, '/a/foo');
      expect(fs.existsSync).toHaveBeenNthCalledWith(6, '/a/bar');
    });
  });
});
