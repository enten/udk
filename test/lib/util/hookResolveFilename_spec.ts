// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import {
  aliasModuleResolveFilename,
  disableModuleResolveFilenameHook,
  enableModuleResolveFilenameHook,
} from '../../../lib/util/hookResolveFilename';

const { Module } = require('module');

const originResolveFilename = Module._resolveFilename;

describe('udk/lib/util/hookResolveFilename', () => {
  describe('enableModuleResolveFilenameHook', () => {
    it('should hook Module._resolveFilename', () => {
      disableModuleResolveFilenameHook();
      expect(Module._resolveFilename).toBe(originResolveFilename);

      enableModuleResolveFilenameHook();
      expect(Module._resolveFilename).not.toBe(originResolveFilename);

      disableModuleResolveFilenameHook();
      expect(Module._resolveFilename).toBe(originResolveFilename);
    });
  });

  describe('aliasModuleResolveFilename', () => {
    it('should register an alias request', () => {
      enableModuleResolveFilenameHook();

      const pkgJsonPath = require.resolve('../../../package');

      const unregister = aliasModuleResolveFilename({
        fromFile: __filename,
        replaceRequest: 'FOO',
        withRequest: require.resolve('../../../package'),
      });

      expect(Module._resolveFilename('../../../package', module)).toEqual(pkgJsonPath);

      expect(Module._resolveFilename('FOO', module)).toEqual(pkgJsonPath);

      expect(() => Module._resolveFilename('FOO', { id: pkgJsonPath }))
        .toThrowError('Cannot find module \'FOO\'');

      disableModuleResolveFilenameHook();

      expect(() => Module._resolveFilename('FOO', module))
        .toThrowError('Cannot find module \'FOO\'');

      enableModuleResolveFilenameHook();

      expect(Module._resolveFilename('FOO', module)).toEqual(pkgJsonPath);

      unregister();

      expect(() => Module._resolveFilename('FOO', module))
        .toThrowError('Cannot find module \'FOO\'');

      disableModuleResolveFilenameHook();
    });
  });
});
