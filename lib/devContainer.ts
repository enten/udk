// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as http from 'http';
import * as path from 'path';

import * as webpack from 'webpack';
import wpc = require('webpack-plugin-compat');

import MultiCompiler from './MultiCompiler';

import {
  ContainerAPI,
  ContainerArgs,
  ContainerConfig,
  ContainerFactory,
  ContainerRuntime,
} from './util/container';

import { configLoader } from './util/configLoader';
import { decorateRequestListener } from './util/decorateRequestListener';
import { ensureConfigHasEntry } from './util/ensureConfigHasEntry';
import { WebpackPluginStatic, ensureConfigHasPlugin } from './util/ensureConfigHasPlugin';
import { existsModule } from './util/existsModule';
import { getEntryOutputPathFromStats } from './util/getEntryOutputPathFromStats';
import { requireModule } from './util/requireModule';

export { ContainerAPI, ContainerFactory } from './util/container';

export interface DevContainerAPI extends ContainerAPI {

}

export interface DevContainerArgs extends ContainerArgs {

}

export interface DevContainerConfig extends ContainerConfig {
  autoRestart?: boolean;
  hmr?: boolean | string | WebpackContainerHMROptions;
  topModuleEntries: (string | RegExp)[];
  webpackConfig?: string;

  beforeRequireNodeBundle?(
    compiler: webpack.Compiler,
    mainOutputPath: string,
    stats: webpack.Stats,
  ): void;
  injectWebpackStats?(
    compilerStats: { [name: string]: webpack.Stats },
    req: http.IncomingMessage,
    res: http.OutgoingMessage,
  ): void;
  onBundleAvailable?(bundle: WebpackBundle): void;
  onCompilerWatchRun?(compiler: webpack.Compiler, done: (err?: Error) => void): void;
  onCompilerBeforeCompile?(
    compiler: webpack.Compiler,
    compilationParams: any, // tslint:disable-line:no-any
    done: (err?: Error) => void,
  ): void;
  onCompilerCompile?(
    compiler: webpack.Compiler,
    compilationParams: any, // tslint:disable-line:no-any
  ): void;
  onCompilerThisCompilation?(
    compiler: webpack.Compiler,
    compilation: webpack.compilation.Compilation,
    compilationParams: any, // tslint:disable-line:no-any
  ): void;
  onCompilerCompilation?(
    compiler: webpack.Compiler,
    compilation: webpack.compilation.Compilation,
    compilationParams: any, // tslint:disable-line:no-any
  ): void;
  onCompilerMake?(
    compiler: webpack.Compiler,
    compilation: webpack.compilation.Compilation,
    done: (err?: Error) => void,
  ): void;
  onCompilerAfterCompile?(
    compiler: webpack.Compiler,
    compilation: webpack.compilation.Compilation,
    done: (err?: Error) => void,
  ): void;
  onCompilerShouldEmit?(
    compiler: webpack.Compiler,
    compilation: webpack.compilation.Compilation,
  ): boolean;
  onCompilerEmit?(
    compiler: webpack.Compiler,
    compilation: webpack.compilation.Compilation,
    done: (err?: Error) => void,
  ): void;
  onCompilerAfterEmit?(
    compiler: webpack.Compiler,
    compilation: webpack.compilation.Compilation,
    done: (err?: Error) => void,
  ): void;
  onCompilerDone?(
    compiler: webpack.Compiler,
    stats: webpack.Stats,
    done?: (err?: Error) => void,
  ): void;
  onCompilerFailed?(compiler: webpack.Compiler, err: Error): void;
  onCompilerInvalid?(compiler: webpack.Compiler, fileName: string, changeTime: number): void;
  onCompilerWatchClose?(compiler: webpack.Compiler): void;
  prepareWebpackCompiler?(compiler: webpack.Compiler): void;
  prepareWebpackNodeCompiler?(compiler: webpack.Compiler): void;
  prepareWebpackWebCompiler?(compiler: webpack.Compiler): void;
  prepareWebpackConfig?(webpackConfig: webpack.Configuration): void;
  prepareWebpackNodeConfig?(webpackConfig: webpack.Configuration): void;
  prepareWebpackWebConfig?(webpackConfig: webpack.Configuration): void;
  printCompilerStats?(stats: webpack.Stats): void;
  requestDecorator?(
    bundle: WebpackBundle,
    req: http.IncomingMessage,
    res: http.OutgoingMessage,
    next: (err?: any) => void, // tslint:disable-line:no-any
  ): void;
}

export interface DevContainerFactory extends ContainerFactory {
  (proc: NodeJS.Process): DevContainerAPI;
}

export interface WebpackContainerHMROptions {
  enable: boolean;
  configs?: string[];
  path?: string;
  entries?: string[];
  entriesNode?: string[];
  entriesWeb?: string[];
  hotPollInterval?: number;
  hotMiddleware?: WebpackHotMiddlewareOptions;
  hotMiddlewareClient?: WebpackHotMiddlewareClientOptions;
  plugin?: WebpackHMRPluginOptions;
  pluginNode?: WebpackHMRPluginOptions;
  pluginWeb?: WebpackHMRPluginOptions;
}

export interface WebpackBundle {
  name: string;
  mainOutputPath: string;
  mainOutputExports: any; // tslint:disable-line:no-any
  mainOutputExportsDefault: any; // tslint:disable-line:no-any
  compiler: webpack.Compiler;
  stats: webpack.Stats;
}

export interface WebpackHMRPluginOptions {
  multiStep?: boolean;
  fullBuildTimeout?: number;
  requestTimeout?: number;
}

export interface WebpackHotMiddlewareOptions {
  path: string;
  log?: boolean | Console['log'];
  heartbeat?: number;
}

export interface WebpackHotMiddlewareClientOptions {
  path?: string;
  name?: string;
  timeout?: number;
  overlay?: boolean;
  reload?: boolean;
  noInfo?: boolean;
  quiet?: boolean;
  dynamicPublicPath?: boolean;
  autoConnect?: boolean;
  ansiColors?: {
    [colorName: string]: string | [ string, string ];
  };
  overlayStyles?: {
    [stylePropName: string]: string;
  };
  overlayWarnings?: boolean;
}

export const BUNDLE_AVAILABLE_EVENT = 'bundleAvailable';

export class DevContainerRuntime extends ContainerRuntime {
  bundles: { [name: string]: WebpackBundle } = {};
  compiler?: webpack.Compiler | webpack.MultiCompiler;
  compilerStats: { [name: string]: webpack.Stats } = {};
  compilerWatching?: webpack.Watching;
  webpackConfig?: webpack.Configuration | webpack.Configuration[];

  emitBundleAvailable(config: DevContainerConfig, stats: webpack.Stats) {
    let bundle: WebpackBundle | undefined = this.bundles[stats.compilation.compiler.name];

    if (bundle && config.autoRestart) {
      if (bundle.mainOutputExportsDefault.close) {
        bundle.mainOutputExportsDefault.close();
      }

      bundle = undefined;
    }

    if (bundle) {
      return bundle;
    }

    // todo: handle entrypoint name from hmr options
    const mainOutputPath = getEntryOutputPathFromStats(stats);

    if (!mainOutputPath || !existsModule(mainOutputPath)) {
      return bundle;
    }

    try {
      if (config.beforeRequireNodeBundle) {
        config.beforeRequireNodeBundle(stats.compilation.compiler, mainOutputPath, stats);
      }

      const mainOutputExports = requireModule(mainOutputPath, {
        cache: false,
        default: false,
      });

      let mainOutputExportsDefault = mainOutputExports;

      if (mainOutputExports.default) {
        mainOutputExportsDefault = mainOutputExports.default;
      }

      bundle = {
        name: stats.compilation.compiler.name,
        mainOutputPath,
        mainOutputExports,
        mainOutputExportsDefault,
        compiler: stats.compilation.compiler,
        stats,
      };

      /* istanbul ignore next */
      decorateRequestListener(mainOutputExportsDefault, (
        req: http.IncomingMessage,
        res: http.ServerResponse,
        next: (err?: Error) => void,
      ) => {
        if (config.injectWebpackStats) {
          config.injectWebpackStats(this.compilerStats, req, res);
        }

        if (config.requestDecorator) {
          config.requestDecorator(bundle as WebpackBundle, req, res, next);
        } else {
          next();
        }
      });

      wpc.callSync(stats.compilation.compiler, BUNDLE_AVAILABLE_EVENT, bundle);

      this.bundles[stats.compilation.compiler.name] = bundle;
    } catch (err) /* istanbul ignore next */ {
      this.logger.error(err);
      this.logger.error('--');
      this.logger.error('RUNTIME ERROR!');
      this.logger.error('Container will shutdown. A container reload is needed.');

      this.proc.exit(1);
    }

    return bundle;
  }

  async getWebpackConfig(config: DevContainerConfig) {
    let configPath = path.resolve(
      config.context as string,
      config.webpackConfig || 'webpack.config',
    );

    configPath = require.resolve(configPath);

    this.debug('[%o] load webpack config %s', this.proc.pid, configPath);

    const loading = await configLoader({ configPath, cwd: config.context });
    const webpackConfig = loading.config;

    return webpackConfig as webpack.Configuration | webpack.Configuration[];
  }

  parseConfigHMR(config: DevContainerConfig): WebpackContainerHMROptions {
    let value = config.hmr;

    if (typeof value === 'undefined') {
      value = true;
    }

    if (typeof value === 'boolean') {
      value = { enable: value } as WebpackContainerHMROptions;
    }

    if (typeof value === 'string') {
      value = { enable: true, path: value } as WebpackContainerHMROptions;
    }

    /* istanbul ignore else */
    if (value && typeof value === 'object') {
      value = { enable: true, ...value };
    }

    let hmr = value as WebpackContainerHMROptions;

    hmr = {
      path: '/__webpack_hmr',
      entries: [ 'main', 'index' ],
      entriesNode: [ 'server' ],
      entriesWeb: [ 'browser' ],
      hotPollInterval: 1000,
      ...hmr,
    } as WebpackContainerHMROptions;

    hmr.entriesNode = ([] as string[]).concat(hmr.entriesNode as string[], hmr.entries as string[]);
    hmr.entriesWeb = ([] as string[]).concat(hmr.entriesWeb as string[], hmr.entries as string[]);

    hmr.hotMiddleware = {
      log: config.logger.info.bind(config.logger),
      ...hmr.hotMiddleware,
      path: hmr.path,
    } as WebpackContainerHMROptions['hotMiddleware'];

    hmr.hotMiddlewareClient = {
      ...hmr.hotMiddlewareClient,
      path: hmr.path,
    } as WebpackContainerHMROptions['hotMiddlewareClient'];

    hmr.plugin = { ...hmr.plugin };
    hmr.pluginNode = { ...hmr.plugin, ...hmr.pluginNode };
    hmr.pluginWeb = { ...hmr.plugin, ...hmr.pluginWeb };

    return hmr;
  }

  parseProcessArgs(): DevContainerArgs {
    return super.parseProcessArgs();
  }

  async prepareConfig(config: DevContainerConfig) {
    await super.prepareConfig(config);

    config.hmr = this.parseConfigHMR(config);

    this.debug('[%o] get webpack config', this.proc.pid);

    this.webpackConfig = await this.getWebpackConfig(config);

    this.debug('[%o] prepare webpack config', this.proc.pid);

    if (Array.isArray(this.webpackConfig)) {
      this.webpackConfig.forEach(c => this.prepareWebpackConfig(config, c));
    } else {
      this.prepareWebpackConfig(config, this.webpackConfig);
    }

    this.tryPrepareUniversalHMR(config, this.webpackConfig);

    this.debug('[%o] create compiler', this.proc.pid);

    if (Array.isArray(this.webpackConfig)) {
      const compilers = this.webpackConfig.map(c => require('./webpack')(c)) as webpack.Compiler[];

      this.compiler = new MultiCompiler(compilers);

      compilers.forEach(c => this.prepareWebpackCompiler(config, c));
    } else {
      this.compiler = require('./webpack')(this.webpackConfig) as webpack.Compiler;

      this.prepareWebpackCompiler(config, this.compiler);
    }
  }

  prepareWebpackCompiler(config: DevContainerConfig, compiler: webpack.Compiler) {
    this.debug('[%o] prepare compiler %s', this.proc.pid, compiler.name);

    const target = compiler.options.target || 'web';
    const isNodeTarget = (target as string).indexOf('node') !== -1;

    const {
      onCompilerWatchRun,
      onCompilerBeforeCompile,
      onCompilerCompile,
      onCompilerThisCompilation,
      onCompilerCompilation,
      onCompilerMake,
      onCompilerAfterCompile,
      onCompilerShouldEmit,
      onCompilerEmit,
      onCompilerAfterEmit,
      onCompilerDone,
      onCompilerFailed,
      onCompilerInvalid,
      onCompilerWatchClose,
      onBundleAvailable,
      prepareWebpackCompiler,
      prepareWebpackNodeCompiler,
      prepareWebpackWebCompiler,
    } = config;

    if (prepareWebpackCompiler) {
      prepareWebpackCompiler.call(config, compiler);
    }

    if (target === 'web' && prepareWebpackWebCompiler) {
      prepareWebpackWebCompiler.call(config, compiler);
    } else if (isNodeTarget && prepareWebpackNodeCompiler) {
      prepareWebpackNodeCompiler.call(config, compiler);
    }

    if (onBundleAvailable) {
      wpc.for('UdkCConfigBundleAvailablePlugin').tap(
        compiler,
        BUNDLE_AVAILABLE_EVENT,
        onBundleAvailable.bind(config),
      );
    }

    if (onCompilerWatchRun) {
      wpc.for('UdkCConfigWatchRunPlugin').tap(
        compiler,
        'watchRun',
        onCompilerWatchRun.bind(config),
      );
    }
    if (onCompilerBeforeCompile) {
      wpc.for('UdkCConfigBeforeCompilePlugin').tap(
        compiler,
        'beforeCompile',
        onCompilerBeforeCompile.bind(config, compiler),
      );
    }
    if (onCompilerCompile) {
      wpc.for('UdkCConfigCompilePlugin').tap(
        compiler,
        'compile',
        onCompilerCompile.bind(config, compiler),
      );
    }
    if (onCompilerThisCompilation) {
      wpc.for('UdkCConfigThisCompilationPlugin').tap(
        compiler,
        'thisCompilation',
        onCompilerThisCompilation.bind(config, compiler),
      );
    }
    if (onCompilerCompilation) {
      wpc.for('UdkCConfigCompilationPlugin').tap(
        compiler,
        'compilation',
        onCompilerCompilation.bind(config, compiler),
      );
    }
    if (onCompilerMake) {
      wpc.for('UdkCConfigMakePlugin').tap(
        compiler,
        'make',
        onCompilerMake.bind(config, compiler),
      );
    }
    if (onCompilerAfterCompile) {
      wpc.for('UdkCConfigAfterCompilePlugin').tap(
        compiler,
        'afterCompile',
        onCompilerAfterCompile.bind(config, compiler),
      );
    }
    if (onCompilerShouldEmit) {
      wpc.for('UdkCConfigShouldEmitPlugin').tap(
        compiler,
        'shouldEmit',
        onCompilerShouldEmit.bind(config, compiler),
      );
    }
    if (onCompilerEmit) {
      wpc.for('UdkCConfigEmitPlugin').tap(
        compiler,
        'emit',
        onCompilerEmit.bind(config, compiler),
      );
    }
    if (onCompilerAfterEmit) {
      wpc.for('UdkCConfigAfterEmitPlugin').tap(
        compiler,
        'afterEmit',
        onCompilerAfterEmit.bind(config, compiler),
      );
    }
    if (onCompilerDone) {
      wpc.for('UdkCConfigDonePlugin').tap(
        compiler,
        'done',
        onCompilerDone.bind(config, compiler),
      );
    }
    if (onCompilerFailed) {
      wpc.for('UdkCConfigFailedPlugin').tap(
        compiler,
        'failed',
        onCompilerFailed.bind(config, compiler),
      );
    }
    if (onCompilerInvalid) {
      wpc.for('UdkCConfigInvalidPlugin').tap(
        compiler,
        'invalid',
        onCompilerInvalid.bind(config, compiler),
      );
    }
    if (onCompilerWatchClose) {
      wpc.for('UdkCConfigWatchClosePlugin').tap(
        compiler,
        'watchClose',
        onCompilerWatchClose.bind(config, compiler),
      );
    }
  }

  prepareWebpackConfig(config: DevContainerConfig, webpackConfig: webpack.Configuration) {
    if (!webpackConfig.context) {
      webpackConfig.context = config.context;
    }

    const target = webpackConfig.target || 'web';
    const isNodeTarget = (target as string).indexOf('node') !== -1;

    if (!webpackConfig.plugins) {
      webpackConfig.plugins = [];
    }

    // store reference to last stats
    webpackConfig.plugins.push({
      apply: (compiler: webpack.Compiler) => {
        wpc.reg(compiler, BUNDLE_AVAILABLE_EVENT, [ 'Sync', 'bundle' ]);

        wpc.for('UdkCCompilerDonePlugin').tap(compiler, 'done', (
          stats: webpack.Stats,
          done: (err?: Error) => void,
        ) => {
          this.compilerStats[compiler.name] = stats;

          if (done) {
            done();
          }
        });
      },
    });

    if (config.prepareWebpackConfig) {
      config.prepareWebpackConfig(webpackConfig);
    }

    if (target === 'web' && config.prepareWebpackWebConfig) {
      config.prepareWebpackWebConfig(webpackConfig);
    } else if (isNodeTarget && config.prepareWebpackNodeConfig) {
      config.prepareWebpackNodeConfig(webpackConfig);
    }
  }

  printCompilerStats(config: DevContainerConfig, stats: webpack.Stats) {
    if (config.printCompilerStats) {
      config.printCompilerStats(stats);
    } else {
      this.logger.info(stats.toString({ colors: true }));
    }
  }

  shutDown(config: DevContainerConfig) {
    if (this.compilerWatching) {
      this.debug('[%o] close compiler watching', this.proc.pid);

      this.compilerWatching.close(() => {});
      this.compilerWatching = undefined;
    }

    super.shutDown(config);
  }

  async shutUp(config: DevContainerConfig) {
    await super.shutUp(config);

    if (!this.compiler) {
      throw new Error('Compiler is not available (container does not seem prepared)');
    }

    // todo: handle watchOptions
    this.compilerWatching = this.compiler.watch({}, (err, stats) => {
      if (err) {
        throw err;
      }

      this.printCompilerStats(config, stats);

      if (stats.hasErrors()) {
        return;
      }

      let multiStats: webpack.Stats[];

      if ('stats' in stats) {
        multiStats = (stats as { stats: webpack.Stats[] }).stats;
      } else {
        multiStats = [ stats ];
      }

      for (const s of multiStats) {
        const { target } = s.compilation.compiler.options;
        const isNodeTarget = !!target && (target as string).indexOf('node') !== -1;

        if (isNodeTarget) {
          this.emitBundleAvailable(config, s);
        }
      }
    });
  }

  tryPrepareUniversalHMR(
    config: DevContainerConfig,
    webpackConfig: webpack.Configuration | webpack.Configuration[],
  ) {
    const hmr = config.hmr as WebpackContainerHMROptions;

    if (!hmr || !hmr.enable) {
      return;
    }

    if (!Array.isArray(webpackConfig)) {
      webpackConfig = [ webpackConfig ];
    }

    const dbug = this.debug;

    let nodeConfigs = webpackConfig.filter(c => c.target && ~(c.target as string).indexOf('node'));
    let webConfigs = webpackConfig.filter(c => !c.target || c.target === 'web');

    if (hmr.configs) {
      const configNames = hmr.configs;

      nodeConfigs = nodeConfigs.filter(({ name }) => name && ~configNames.indexOf(name));
      webConfigs = webConfigs.filter(({ name }) => name && ~configNames.indexOf(name));
    }

    const NoEmitOnErrorsPlugin: WebpackPluginStatic = require('webpack/lib/NoEmitOnErrorsPlugin');
    const HMRPlugin: WebpackPluginStatic = require('webpack/lib/HotModuleReplacementPlugin');

    ensureConfigHasPlugin(nodeConfigs, NoEmitOnErrorsPlugin);
    ensureConfigHasPlugin(webConfigs, NoEmitOnErrorsPlugin);

    ensureConfigHasPlugin(webConfigs, HMRPlugin, [ hmr.pluginWeb ]);

    if (!config.autoRestart) {
      ensureConfigHasPlugin(nodeConfigs, HMRPlugin, [ hmr.pluginNode ]);

      ensureConfigHasEntry(nodeConfigs, 'webpack/hot/poll', hmr.hotPollInterval, {
        entriesFilter: hmr.entriesNode,
        topModuleEntries: config.topModuleEntries,
      });
    }

    webConfigs.forEach(webConfig => {
      const { name } = webConfig;
      const hotMiddlewareOptions = { ...hmr.hotMiddlewareClient, name };

      ensureConfigHasEntry(webConfig, 'webpack-hot-middleware/client', hotMiddlewareOptions, {
        entriesFilter: hmr.entriesWeb,
        topModuleEntries: config.topModuleEntries,
      });
    });

    nodeConfigs.forEach((nodeConfig) => {
      (nodeConfig.plugins as webpack.Plugin[]).push({
        apply: (compiler: webpack.Compiler) => {
          let hotMiddleware: (
            req: http.IncomingMessage,
            res: http.ServerResponse,
            next: (err?: Error) => void,
          ) => void;

          wpc.for('UdkCNodeHMRPlugin').tap(compiler, BUNDLE_AVAILABLE_EVENT, (
            bundle: WebpackBundle,
          ) => {
            decorateRequestListener(bundle.mainOutputExportsDefault, (req, res, next) => {
              if (!hotMiddleware) {
                dbug('create webpack-hot-middleware %O', hmr.hotMiddleware);

                hotMiddleware = require('webpack-hot-middleware')(this.compiler, hmr.hotMiddleware);
              }

              hotMiddleware(req, res, next);
            });
          });
        },
      });
    });
  }
}

export default DevContainerRuntime.export(module) as DevContainerFactory;
