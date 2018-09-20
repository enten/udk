// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

import { ensureConfigHasPlugin } from '../../../lib/util/ensureConfigHasPlugin';

describe('udk/lib/util/ensureConfigHasPlugin', () => {
  describe('ensureConfigHasPlugin', () => {
    it('should add plugin if is not exists', () => {
      const config = { plugins: [] } as webpack.Configuration;
      let givenArgs: any[] = []; // tslint:disable-line:no-any

      class PluginFixture {
        constructor(...args: any[]) { // tslint:disable-line:no-any
          givenArgs = args;
        }
        apply() { }
      }

      ensureConfigHasPlugin(config, PluginFixture, [ 'a', 'b' ]);

      expect('plugins' in config).toBeTruthy();
      expect(Array.isArray(config.plugins)).toBeTruthy();
      expect(config.plugins && config.plugins.length).toEqual(1);
      expect(config.plugins && config.plugins[0] instanceof PluginFixture).toBeTruthy();
      expect(givenArgs.length).toEqual(2);
      expect(givenArgs).toEqual([ 'a', 'b' ]);

      ensureConfigHasPlugin(config, PluginFixture);

      expect(config.plugins && config.plugins.length).toEqual(1);

      delete config.plugins;

      ensureConfigHasPlugin(config, PluginFixture);

      expect(config.plugins && (config.plugins as Array<{}>).length).toEqual(1);
    });

    it('should works with array of configs', () => {
      const config = {} as webpack.Configuration;
      const config2 = {} as webpack.Configuration;
      class PluginFixture { apply() {} }

      ensureConfigHasPlugin([ config, config2 ], PluginFixture);

      expect('plugins' in config).toBeTruthy();
      expect(Array.isArray(config.plugins)).toBeTruthy();
      expect(config.plugins && config.plugins.length).toEqual(1);
      expect(config.plugins && config.plugins[0] instanceof PluginFixture).toBeTruthy();

      expect('plugins' in config2).toBeTruthy();
      expect(Array.isArray(config2.plugins)).toBeTruthy();
      expect(config2.plugins && config2.plugins.length).toEqual(1);
      expect(config2.plugins && config2.plugins[0] instanceof PluginFixture).toBeTruthy();
    });
  });
});
