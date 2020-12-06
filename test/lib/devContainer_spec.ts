// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as path from 'path';

import * as webpack from 'webpack';
import wpc = require('../../webpack-plugin-compat');

import {
  BUNDLE_AVAILABLE_EVENT,
  DevContainerConfig,
  DevContainerRuntime,
  WebpackBundle,
  default as DevContainer,
} from '../../lib/devContainer';

import { getEntryOutputPathFromStats } from '../../lib/util/getEntryOutputPathFromStats';

jest.mock('webpack-hot-middleware', () => jest.fn(() => jest.fn()));
jest.mock('webpack-plugin-compat', () => ({
  for: jest.fn((pluginName: string) => ({
    tap: jest.fn(),
  })),
  callSync: jest.fn(),
  reg: jest.fn(),
}));

jest.mock('../../package');
jest.mock('../../lib/util/getEntryOutputPathFromStats');

afterAll(() => {
  jest.unmock('webpack-hot-middleware');
  jest.unmock('webpack-plugin-compat');

  jest.unmock('../../package');
  jest.unmock('../../lib/util/getEntryOutputPathFromStats');
});

const DevContainerRuntimePath = require.resolve('../../lib/devContainer');
const PackageJsonPath = require.resolve('../../package');
const PackageJson = require('../../package');

describe('udk/lib/devContainer', () => { // tslint:disable-line:no-big-function
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DevContainer', () => {
    it('should be an instance of DevContainerRuntime', () => {
      const c = DevContainer({
        argv: [],
        cwd: process.cwd,
      } as {} as NodeJS.Process);

      expect(c).toBeInstanceOf(DevContainerRuntime);
    });
  });

  describe('DevContainerRuntime', () => { // tslint:disable-line:no-big-function
    describe('emitBundleAvailable', () => {
      let c: DevContainerRuntime;

      beforeEach(() => {
        c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);
      });

      it('should return exists bundle when config.autoRestart is not true', () => {
        const bundle = {};

        c.bundles = { foo: bundle } as {} as { [key: string]: WebpackBundle };

        const config = {} as DevContainerConfig;
        const stats = { compilation: { compiler: { name: 'foo' } } } as webpack.Stats;

        expect(c.emitBundleAvailable(config, stats)).toBe(bundle);
      });

      it('should return undefined when no main output path resolved or output not exists', () => {
        const config = {} as DevContainerConfig;
        const stats = { compilation: { compiler: { name: 'foo' } } } as webpack.Stats;

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => null);

        expect(c.emitBundleAvailable(config, stats)).toBeUndefined();

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => 'fake-module');

        expect(c.emitBundleAvailable(config, stats)).toBeUndefined();
      });

      it('should return bundle when output module exists', () => {
        const config = {} as DevContainerConfig;
        const stats = { compilation: { compiler: { name: 'foo' } } } as webpack.Stats;

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => null);

        expect(c.emitBundleAvailable(config, stats)).toBeUndefined();

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => PackageJsonPath);

        const bundle = c.emitBundleAvailable(config, stats) as WebpackBundle;

        expect(bundle).toBe(c.bundles.foo);
        expect(bundle.mainOutputPath).toEqual(PackageJsonPath);
        expect(bundle.mainOutputExports).toEqual(PackageJson);
        expect(bundle.mainOutputExports).toBe(bundle.mainOutputExportsDefault);
        expect(bundle.compiler).toBe(stats.compilation.compiler);
        expect(bundle.stats).toBe(stats);

        expect(wpc.callSync).toBeCalledWith(
          stats.compilation.compiler,
          BUNDLE_AVAILABLE_EVENT,
          bundle,
        );
      });

      it('should return bundle default export when output module exists', () => {
        const config = {} as DevContainerConfig;
        const stats = { compilation: { compiler: { name: 'foo' } } } as webpack.Stats;

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => null);

        expect(c.emitBundleAvailable(config, stats)).toBeUndefined();

        (getEntryOutputPathFromStats as jest.Mock)
          .mockImplementation(() => DevContainerRuntimePath);

        let bundle = c.emitBundleAvailable(config, stats) as WebpackBundle;

        expect(bundle).toBeDefined();
        expect(bundle.mainOutputExports).not.toBe(bundle.mainOutputExportsDefault);

        c.bundles = {};

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => PackageJsonPath);

        bundle = c.emitBundleAvailable(config, stats) as WebpackBundle;

        expect(bundle).toBeDefined();
        expect(bundle.mainOutputExports).toBe(bundle.mainOutputExportsDefault);
      });

      it('should call config.beforeRequireNodeBundle if exists', () => {
        const beforeRequireNodeBundle = jest.fn();
        const config = { beforeRequireNodeBundle } as {} as DevContainerConfig;
        const stats = { compilation: { compiler: { name: 'foo' } } } as webpack.Stats;

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => PackageJsonPath);

        c.emitBundleAvailable(config, stats);

        expect(beforeRequireNodeBundle).toBeDefined();
        expect(beforeRequireNodeBundle).toBeCalledWith(
          stats.compilation.compiler,
          PackageJsonPath,
          stats,
        );
      });

      it('should clear previous bundle when config.autoRestart is true', () => {
        const bundle = { mainOutputExportsDefault: {} };

        c.bundles = { foo: bundle } as {} as { [key: string]: WebpackBundle };

        const config = { autoRestart: true } as DevContainerConfig;
        const stats = { compilation: { compiler: { name: 'foo' } } } as webpack.Stats;

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => PackageJsonPath);

        expect(c.emitBundleAvailable(config, stats)).not.toBe(bundle);
        expect(c.bundles.foo).not.toBe(bundle);
      });

      it('should call close when clear previous bundle has it', () => {
        const close = jest.fn();
        const bundle = { mainOutputExportsDefault: { close } };

        c.bundles = { foo: bundle } as {} as { [key: string]: WebpackBundle };

        const config = { autoRestart: true } as DevContainerConfig;
        const stats = { compilation: { compiler: { name: 'foo' } } } as webpack.Stats;

        (getEntryOutputPathFromStats as jest.Mock).mockImplementation(() => PackageJsonPath);

        c.emitBundleAvailable(config, stats);

        expect(close).toBeCalled();
      });
    });

    describe('getWebpackConfg', () => {
      it('should be an instance of DevContainerRuntime', async () => {
        const c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);

        expect(await c.getWebpackConfig({
          context: path.resolve(__dirname, '..', 'e2e'),
        } as DevContainerConfig)).toBeTruthy();
      });
    });

    describe('parseConfigHMR', () => {
      let c: DevContainerRuntime;

      beforeEach(() => {
        c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);
      });

      it('should set enable as default', () => {
        const hmr = c.parseConfigHMR({ logger: console } as DevContainerConfig);

        expect(hmr.enable).toBeTruthy();
      });

      it('should set enable with boolean given', () => {
        let hmr = c.parseConfigHMR({ hmr: false, logger: console } as DevContainerConfig);

        expect(hmr.enable).toBeFalsy();

        hmr = c.parseConfigHMR({ hmr: true, logger: console } as DevContainerConfig);

        expect(hmr.enable).toBeTruthy();
      });

      it('should set default hotPollInterval to 1000', () => {
        let hmr = c.parseConfigHMR({ hmr: {}, logger: console } as DevContainerConfig);

        expect(hmr.enable).toBeTruthy();
        expect(hmr.hotPollInterval).toEqual(1000);

        hmr = c.parseConfigHMR({
          hmr: { hotPollInterval: 111 },
          logger: console,
        } as DevContainerConfig);

        expect(hmr.enable).toBeTruthy();
        expect(hmr.hotPollInterval).toEqual(111);
      });

      it('should enable when a bar hmr path string is given', () => {
        const hmr = c.parseConfigHMR({ hmr: '/hmr', logger: console } as DevContainerConfig);

        expect(hmr.enable).toBeTruthy();
        expect(hmr.path).toEqual('/hmr');
        expect(hmr.hotMiddleware && hmr.hotMiddleware.path).toEqual(hmr.path);
        expect(hmr.hotMiddlewareClient && hmr.hotMiddlewareClient.path).toEqual(hmr.path);
      });

      it('should have default hmr entries', () => {
        const hmr = c.parseConfigHMR({ hmr: {}, logger: console } as DevContainerConfig);

        expect(hmr.entries).toEqual([ 'main', 'index' ]);
        expect(hmr.entriesNode).toEqual([ 'server', 'main', 'index' ]);
        expect(hmr.entriesWeb).toEqual([ 'browser', 'main', 'index' ]);
      });

      it('should concat hmr entries options into entriesNode and entriesWeb', () => {
        const hmr = c.parseConfigHMR({
          hmr: {
            entries: [ 'bar' ],
            entriesNode: [ 'foo' ],
            entriesWeb: [ 'foo' ],
          },
          logger: console,
        } as DevContainerConfig);

        expect(hmr.entries).toEqual([ 'bar' ]);
        expect(hmr.entriesNode).toEqual([ 'foo', 'bar' ]);
        expect(hmr.entriesWeb).toEqual([ 'foo', 'bar' ]);
      });

      it('should merge hmr plugin options into pluginNode and pluginWeb', () => {
        const hmr = c.parseConfigHMR({
          hmr: {
            plugin: { requestTimeout: 111 },
            pluginNode: { multiStep: true },
            pluginWeb: { multiStep: false, requestTimeout: 222 },
          },
          logger: console,
        } as DevContainerConfig);

        expect(hmr.plugin).toEqual({ requestTimeout: 111 });
        expect(hmr.pluginNode).toEqual({ requestTimeout: 111, multiStep: true });
        expect(hmr.pluginWeb).toEqual({ requestTimeout: 222, multiStep: false });
      });
    });

    describe('prepareConfig', () => {
      it('should load and prepare webpack config', async () => {
        const c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);

        const getWebpackConfig = jest.fn(() => Promise.resolve({ }));
        const prepareWebpackCompiler = jest.fn();
        const prepareWebpackConfig = jest.fn();
        const tryPrepareUniversalHMR = jest.fn();

        c.getWebpackConfig = getWebpackConfig;
        c.prepareWebpackCompiler = prepareWebpackCompiler;
        c.prepareWebpackConfig = prepareWebpackConfig;
        c.tryPrepareUniversalHMR = tryPrepareUniversalHMR;

        const config = {} as DevContainerConfig;

        await c.prepareConfig(config);

        expect(getWebpackConfig).toBeCalled();
        expect(prepareWebpackCompiler).toBeCalledTimes(1);
        expect(prepareWebpackConfig).toBeCalledTimes(1);
        expect(tryPrepareUniversalHMR).toBeCalledTimes(1);

        getWebpackConfig.mockClear();
        prepareWebpackCompiler.mockClear();
        prepareWebpackConfig.mockClear();
        tryPrepareUniversalHMR.mockClear();

        getWebpackConfig.mockImplementation(() => Promise.resolve([
          { name: 'foo' },
          { name: 'bar' },
        ]));

        await c.prepareConfig(config);

        expect(getWebpackConfig).toBeCalled();
        expect(prepareWebpackCompiler).toBeCalledTimes(2);
        expect(prepareWebpackConfig).toBeCalledTimes(2);
        expect(tryPrepareUniversalHMR).toBeCalled();
      });
    });

    describe('prepareWebpackCompiler', () => {
      it('should mount config hooks when exists', async () => {
        const wpcFor = wpc.for as jest.Mock;

        const c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);

        const config = {} as DevContainerConfig;
        const compiler = { options: {} } as webpack.Compiler;

        c.prepareWebpackCompiler(config, compiler);

        expect(wpcFor).not.toBeCalled();

        const prepareWebpackCompiler = jest.fn();
        const prepareWebpackNodeCompiler = jest.fn();
        const prepareWebpackWebCompiler = jest.fn();

        config.prepareWebpackCompiler = prepareWebpackCompiler;
        config.prepareWebpackNodeCompiler = prepareWebpackNodeCompiler;
        config.prepareWebpackWebCompiler = prepareWebpackWebCompiler;
        config.onBundleAvailable = () => {};
        config.onCompilerWatchRun = () => {};
        config.onCompilerBeforeCompile = () => {};
        config.onCompilerCompile = () => {};
        config.onCompilerThisCompilation = () => {};
        config.onCompilerCompilation = () => {};
        config.onCompilerMake = () => {};
        config.onCompilerAfterCompile = () => {};
        config.onCompilerShouldEmit = () => true;
        config.onCompilerEmit = () => {};
        config.onCompilerAfterEmit = () => {};
        config.onCompilerDone = () => {};
        config.onCompilerFailed = () => {};
        config.onCompilerInvalid = () => {};
        config.onCompilerWatchClose = () => {};

        c.prepareWebpackCompiler(config, compiler);

        expect(prepareWebpackCompiler).toBeCalled();
        expect(prepareWebpackNodeCompiler).not.toBeCalled();
        expect(prepareWebpackWebCompiler).toBeCalled();
        expect(wpcFor).toBeCalled();
        expect(wpcFor).toBeCalledTimes(15);
        expect(wpcFor).toHaveBeenNthCalledWith(1, 'UdkCConfigBundleAvailablePlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(2, 'UdkCConfigWatchRunPlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(3, 'UdkCConfigBeforeCompilePlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(4, 'UdkCConfigCompilePlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(5, 'UdkCConfigThisCompilationPlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(6, 'UdkCConfigCompilationPlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(7, 'UdkCConfigMakePlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(8, 'UdkCConfigAfterCompilePlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(9, 'UdkCConfigShouldEmitPlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(10, 'UdkCConfigEmitPlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(11, 'UdkCConfigAfterEmitPlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(12, 'UdkCConfigDonePlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(13, 'UdkCConfigFailedPlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(14, 'UdkCConfigInvalidPlugin');
        expect(wpcFor).toHaveBeenNthCalledWith(15, 'UdkCConfigWatchClosePlugin');

        prepareWebpackWebCompiler.mockClear();

        compiler.options.target = 'web';

        c.prepareWebpackCompiler(config, compiler);

        expect(prepareWebpackWebCompiler).toBeCalled();


        compiler.options.target = 'node';

        c.prepareWebpackCompiler(config, compiler);

        expect(prepareWebpackNodeCompiler).toBeCalled();
      });
    });

    describe('prepareWebpackConfig', () => {
      const wpcFor = wpc.for as jest.Mock;
      const wpcReg = wpc.reg as jest.Mock;

      let c: DevContainerRuntime;

      beforeEach(() => {
        c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);
      });

      it('should set config.context to webpackConfig.context if not exists', () => {
        const config = { context: 'foo' } as DevContainerConfig;
        const webpackConfig = {} as webpack.Configuration;

        c.prepareWebpackConfig(config, webpackConfig);

        expect(webpackConfig.context).toEqual('foo');
      });

      it('should add plugin to collect stats', () => {
        const config = {} as DevContainerConfig;
        const webpackConfig = { context: '/' } as webpack.Configuration;

        c.prepareWebpackConfig(config, webpackConfig);

        expect(webpackConfig.plugins).toBeDefined();
        expect(webpackConfig.plugins && webpackConfig.plugins.length).toEqual(1);

        wpcFor.mockClear();
        wpcReg.mockClear();

        webpackConfig.plugins = [];

        c.prepareWebpackConfig(config, webpackConfig);

        expect(webpackConfig.plugins).toBeDefined();
        expect(webpackConfig.plugins && webpackConfig.plugins.length).toEqual(1);

        if (webpackConfig.plugins) {
          const compiler = { name: 'foo' } as webpack.Compiler;
          const stats = {} as webpack.Stats;
          const plugin = webpackConfig.plugins.pop() as webpack.Plugin;

          expect(plugin).toBeDefined();

          plugin.apply(compiler);

          expect(wpcReg).toBeCalledWith(compiler, BUNDLE_AVAILABLE_EVENT, [ 'Sync', 'bundle' ]);
          expect(wpcFor).toBeCalledTimes(1);
          expect(wpcFor).toBeCalledWith('UdkCCompilerDonePlugin');

          const tap = wpcFor.mock.results[0].value.tap;
          expect(typeof tap).toEqual('function');
          expect(tap).toBeCalled();
          expect(tap.mock.calls[0][0]).toBe(compiler);
          expect(tap.mock.calls[0][1]).toBe('done');
          expect(typeof tap.mock.calls[0][2]).toBe('function');

          tap.mock.calls[0][2](stats);

          expect(c.compilerStats.foo).toBeDefined();
          expect(c.compilerStats.foo).toBe(stats);

          const done = jest.fn();

          tap.mock.calls[0][2](stats, done);

          expect(done).toBeCalled();
        }
      });

      it('should call config.prepareWebpackConfig if exists', () => {
        const c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);

        const config = {} as DevContainerConfig;
        const webpackConfig = {} as webpack.Configuration;

        const prepareWebpackConfig = jest.fn();
        const prepareWebpackNodeConfig = jest.fn();
        const prepareWebpackWebConfig = jest.fn();

        config.prepareWebpackConfig = prepareWebpackConfig;
        config.prepareWebpackWebConfig = prepareWebpackWebConfig;
        config.prepareWebpackNodeConfig = prepareWebpackNodeConfig;

        c.prepareWebpackConfig(config, webpackConfig);

        expect(prepareWebpackConfig).toBeCalledWith(webpackConfig);
        expect(prepareWebpackWebConfig).toBeCalledWith(webpackConfig);

        webpackConfig.target = 'web';

        prepareWebpackWebConfig.mockClear();

        c.prepareWebpackConfig(config, webpackConfig);

        expect(prepareWebpackWebConfig).toBeCalledWith(webpackConfig);

        webpackConfig.target = 'node';

        c.prepareWebpackConfig(config, webpackConfig);

        expect(prepareWebpackNodeConfig).toBeCalledWith(webpackConfig);
      });
    });

    describe('printCompilerStats', () => {
      it('should use config.printCompilerStats if exists', () => {
        const c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);

        const toString = jest.fn(() => 'fake stats');
        const stats = { toString } as {} as webpack.Stats;
        const logger = { info: jest.fn() };
        const printCompilerStats = jest.fn();
        const config = {} as DevContainerConfig;

        (c as any).logger = logger; // tslint:disable-line: no-any

        c.printCompilerStats(config, stats);

        expect(toString).toBeCalled();
        expect(logger.info).toBeCalledWith('fake stats');

        config.printCompilerStats = printCompilerStats;

        c.printCompilerStats(config, stats);

        expect(printCompilerStats).toBeCalled();
      });
    });

    describe('onShutDown', () => {
      it('should close compilerWatching if exists', () => {
        const c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);

        const config = {} as DevContainerConfig;

        c.onShutDown(config);

        expect(c.compilerWatching).toBeUndefined();

        const compilerWatching = { close: jest.fn() } as any; // tslint:disable-line:no-any
        c.compilerWatching = compilerWatching;

        c.onShutDown(config);

        expect(c.compilerWatching).toBeUndefined();
        expect(compilerWatching.close).toBeCalled();
        expect(typeof compilerWatching.close.mock.calls[0][0]).toEqual('function');

        compilerWatching.close.mock.calls[0][0]();
      });
    });

    describe('onShutUp', () => {
      let c: DevContainerRuntime;

      beforeEach(() => {
        c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);
      });

      it('should throw when webpack compiler is missing', () => {
        const config = {} as DevContainerConfig;

        c.onShutUp(config).then(fail).catch(err =>
          expect(err.message)
            .toEqual('Compiler is not available (container does not seem prepared)'));
      });

      it('should call compiler watch', async () => {
        const compiler = { watch: jest.fn() };
        const config = {} as DevContainerConfig;

        c.compiler = compiler as {} as webpack.Compiler;

        await c.onShutUp(config);

        expect(compiler.watch).toBeCalled();
        expect(compiler.watch.mock.calls.length).toEqual(1);
        expect(compiler.watch.mock.calls[0][0]).toEqual({});
        expect(typeof compiler.watch.mock.calls[0][1]).toEqual('function');

        expect(() => compiler.watch.mock.calls[0][1](new Error('fake error')))
          .toThrowError('fake error');
      });

      it('should throw when error happens', async () => {
        const compiler = { watch: jest.fn() };
        const config = {} as DevContainerConfig;

        c.compiler = compiler as {} as webpack.Compiler;

        await c.onShutUp(config);

        expect(typeof compiler.watch.mock.calls[0][1]).toEqual('function');

        expect(() => compiler.watch.mock.calls[0][1](new Error('fake error')))
          .toThrowError('fake error');
      });

      it('should call printCompilerStats no error', async () => {
        const compiler = { watch: jest.fn() };
        const config = {} as DevContainerConfig;

        const stats = {
          hasErrors: () => {},
          compilation: { compiler: { options: {} } },
        } as webpack.Stats;

        const printCompilerStats = jest.fn();

        c.printCompilerStats = printCompilerStats;
        c.compiler = compiler as {} as webpack.Compiler;

        await c.onShutUp(config);

        expect(typeof compiler.watch.mock.calls[0][1]).toEqual('function');
        expect(() => compiler.watch.mock.calls[0][1](null, stats)).not.toThrowError();
        expect(printCompilerStats).toBeCalledWith(config, stats);
      });

      it('should call emitBundleAvailable for each node compiler when no error', async () => {
        const compiler = { watch: jest.fn() };
        const config = {} as DevContainerConfig;

        const stats = {
          hasErrors: () => true,
          compilation: { compiler: { options: { target: '' } } },
        } as {} as webpack.Stats;

        const emitBundleAvailable = jest.fn();

        c.emitBundleAvailable = emitBundleAvailable;
        c.printCompilerStats = () => {};
        c.compiler = compiler as {} as webpack.Compiler;

        await c.onShutUp(config);

        expect(typeof compiler.watch.mock.calls[0][1]).toEqual('function');
        expect(() => compiler.watch.mock.calls[0][1](null, stats)).not.toThrowError();
        expect(emitBundleAvailable).not.toBeCalled();

        stats.hasErrors = () => false;

        expect(() => compiler.watch.mock.calls[0][1](null, stats)).not.toThrowError();
        expect(emitBundleAvailable).not.toBeCalled();

        stats.compilation.compiler.options.target = 'node';

        expect(() => compiler.watch.mock.calls[0][1](null, stats)).not.toThrowError();
        expect(emitBundleAvailable).toBeCalledWith(config, stats);

        const multiStats = {
          hasErrors: () => false,
          stats: [
            { compilation: { compiler: { options: {} } } },
            stats,
          ],
        };

        emitBundleAvailable.mockClear();

        expect(() => compiler.watch.mock.calls[0][1](null, multiStats)).not.toThrowError();
        expect(emitBundleAvailable).toBeCalledWith(config, stats);
      });
    });

    describe('tryPrepareUniversalHMR', () => {
      let c: DevContainerRuntime;

      beforeEach(() => {
        c = new DevContainerRuntime(DevContainerRuntimePath, {
          argv: [],
          cwd: process.cwd,
        } as {} as NodeJS.Process);
      });

      it('should do nothing when config.hmr is disable', () => {
        let config = {} as DevContainerConfig;
        const webpackConfig = {} as webpack.Configuration;

        c.tryPrepareUniversalHMR(config, webpackConfig);

        expect(webpackConfig.plugins).toBeUndefined();

        config = { hmr: { enable: false } } as DevContainerConfig;

        c.tryPrepareUniversalHMR(config, webpackConfig);

        expect(webpackConfig.plugins).toBeUndefined();

        config = { hmr: { enable: true } } as DevContainerConfig;

        c.tryPrepareUniversalHMR(config, webpackConfig);

        expect(webpackConfig.plugins).toBeDefined();
      });

      it('should do nothing to config which it name is not in config.hmr.configs', () => {
        const config = { hmr: { enable: true, configs: [] } } as {} as DevContainerConfig;

        const webpackConfig = [
          { target: 'web', name: 'foo' },
          { target: 'node', name: 'bar' },
        ] as webpack.Configuration[];

        c.tryPrepareUniversalHMR(config, webpackConfig);

        expect(webpackConfig[0].plugins).toBeUndefined();
        expect(webpackConfig[0].plugins).toBeUndefined();
      });

      it('should add NoEmitOnErrorsPlugin', () => {
        const NoEmitOnErrorsPlugin = require('webpack/lib/NoEmitOnErrorsPlugin');

        const config = { hmr: { enable: true } } as DevContainerConfig;
        const webpackConfig = [
          { target: 'web' },
          { target: 'node' },
        ] as webpack.Configuration[];

        c.tryPrepareUniversalHMR(config, webpackConfig);

        expect(Array.isArray(webpackConfig[0].plugins)).toBeTruthy();
        expect(Array.isArray(webpackConfig[1].plugins)).toBeTruthy();

        expect((webpackConfig[0].plugins as webpack.Plugin[])[0])
          .toBeInstanceOf(NoEmitOnErrorsPlugin);
        expect((webpackConfig[1].plugins as webpack.Plugin[])[0])
          .toBeInstanceOf(NoEmitOnErrorsPlugin);
      });

      it('should add HotModuleReplacementPlugin', () => {
        const HotModuleReplacementPlugin = require('webpack/lib/HotModuleReplacementPlugin');

        const config = { hmr: { enable: true } } as DevContainerConfig;
        const webpackConfig = [
          { target: 'web' },
          { target: 'node' },
        ] as webpack.Configuration[];

        c.tryPrepareUniversalHMR(config, webpackConfig);

        expect(Array.isArray(webpackConfig[0].plugins)).toBeTruthy();
        expect(Array.isArray(webpackConfig[1].plugins)).toBeTruthy();

        expect((webpackConfig[0].plugins as webpack.Plugin[])[1])
          .toBeInstanceOf(HotModuleReplacementPlugin);
        expect((webpackConfig[1].plugins as webpack.Plugin[])[1])
          .toBeInstanceOf(HotModuleReplacementPlugin);
      });

      it('should add HotModuleReplacementPlugin to node config when autoRestart is false', () => {
        const HotModuleReplacementPlugin = require('webpack/lib/HotModuleReplacementPlugin');

        const config = { hmr: { enable: true }, autoRestart: true } as DevContainerConfig;
        const webpackConfig = { target: 'node' } as webpack.Configuration;

        c.tryPrepareUniversalHMR(config, webpackConfig);

        expect((webpackConfig.plugins as webpack.Plugin[])[1])
          .not.toBeInstanceOf(HotModuleReplacementPlugin);
      });

      it('should add plugin to node config for mount webpack-hot-middleware', () => {
        const config = { hmr: { enable: true, hotMiddleware: {} } } as DevContainerConfig;
        const webpackConfig = { target: 'node' } as webpack.Configuration;

        c.compiler = {} as webpack.Compiler;

        c.tryPrepareUniversalHMR(config, webpackConfig);

        const customHmrPlugin = (webpackConfig.plugins as webpack.Plugin[])[2] as webpack.Plugin;

        expect(customHmrPlugin).toBeDefined();
        expect(typeof customHmrPlugin.apply).toEqual('function');

        customHmrPlugin.apply(c.compiler);

        expect(wpc.for).toBeCalledWith('UdkCNodeHMRPlugin');

        const tap = (wpc.for as jest.Mock).mock.results[0].value.tap as jest.Mock;

        expect(tap).toBeCalled();
        expect(tap.mock.calls[0][0]).toBe(c.compiler);
        expect(tap.mock.calls[0][1]).toBe(BUNDLE_AVAILABLE_EVENT);
        expect(typeof tap.mock.calls[0][2]).toEqual('function');

        const requestListener = jest.fn();
        const bundle = { mainOutputExportsDefault: { _events: { request: requestListener } } };

        tap.mock.calls[0][2](bundle);

        expect(bundle.mainOutputExportsDefault._events.request).not.toBe(requestListener);

        const req = {};
        const res = { write: jest.fn(), end: jest.fn() };
        const next = jest.fn();

        bundle.mainOutputExportsDefault._events.request(req, res, next);

        const webpackHotMiddleware = require('webpack-hot-middleware') as jest.Mock;

        expect(webpackHotMiddleware).toBeCalledTimes(1);

        bundle.mainOutputExportsDefault._events.request(req, res, next);

        expect(webpackHotMiddleware).toBeCalledTimes(1);
      });
    });
  });
});
