// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import * as fs from 'fs';

import { BuilderContext, BuilderOutput, Target } from '@angular-devkit/architect';

import { ExecutionTransformer } from '@angular-devkit/build-angular';
import {
  WebpackConfigOptions,
} from '@angular-devkit/build-angular/src/angular-cli-files/models/build-options';
import {
  getAotConfig,
  getCommonConfig,
  getNonAotConfig,
  getServerConfig,
  getStatsConfig,
  getStylesConfig,
} from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs';
import {
  statsErrorsToString,
  statsToString,
  statsWarningsToString,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/stats';
import { buildBrowserWebpackConfigFromContext } from '@angular-devkit/build-angular/src/browser';
import { Schema as BrowserBuilderSchema } from '@angular-devkit/build-angular/src/browser/schema';
import { Schema as ServerBuilderOptions } from '@angular-devkit/build-angular/src/server/schema';
import { deleteOutputDir } from '@angular-devkit/build-angular/src/utils/delete-output-dir';
import {
  NormalizedBrowserBuilderSchema,
} from '@angular-devkit/build-angular/src/utils/normalize-builder-schema';
import {
  generateBrowserWebpackConfigFromContext,
} from '@angular-devkit/build-angular/src/utils/webpack-browser-config';

import { WebpackLoggingCallback } from '@angular-devkit/build-webpack';
import { getEmittedFiles } from '@angular-devkit/build-webpack/src/utils';

import {
  experimental,
  getSystemPath,
  json,
  logging,
  normalize,
  resolve,
  terminal,
  virtualFs,
} from '@angular-devkit/core';

import { Observable, from, of } from 'rxjs';
import { concatMap } from 'rxjs/operators';

import webpack = require('webpack');
import webpackMerge = require('webpack-merge');
import { BuildUdkSchema } from './schema';

export {
  WriteIndexHtmlOptions,
  writeIndexHtml,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/index-file/write-index-html';
export {
  readTsconfig,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/read-tsconfig';
export {
  augmentAppWithServiceWorker,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/service-worker';
export {
  FileReplacement,
  Schema as BrowserBuilderSchema,
} from '@angular-devkit/build-angular/src/browser/schema';
export { Schema as ServerBuilderSchema } from '@angular-devkit/build-angular/src/server/schema';
export {
  BuildBrowserFeatures,
} from '@angular-devkit/build-angular/src/utils/build-browser-features';
export { Version } from '@angular-devkit/build-angular/src/utils/version';


export type UdkBuilderEmittedFile = json.JsonObject & {
  name?: string;
  file: string;
  initial: boolean;
  extension: string;
};


export type UdkBuilderOutput = BuilderOutput & {
  success: boolean;
  udkOptions: BuildUdkSchema;
  browserOptions: BrowserBuilderSchema;
  serverOptions: ServerBuilderOptions;
  browserES5EmittedFiles: UdkBuilderEmittedFile[];
  browserES6EmittedFiles: UdkBuilderEmittedFile[];
  browserFiles: UdkBuilderEmittedFile[];
  browserModuleFiles: UdkBuilderEmittedFile[];
  browserNoModuleFiles: UdkBuilderEmittedFile[];
  serverEmittedFiles: UdkBuilderEmittedFile[];
};


export type UdkPartialWebpackConfig = webpack.Configuration
  | webpack.Configuration[]
  | Observable<webpack.Configuration>
  | Promise<webpack.Configuration>
  | ExecutionTransformer<webpack.Configuration>
  | string
  | undefined
  ;


export function adaptWebpackLoggingCallback(logFn: WebpackLoggingCallback) {
  return (
    multiStats: webpack.Stats | { stats: webpack.Stats[] },
    multiConfig: webpack.Configuration | webpack.Configuration[],
  ) => {
    if (!multiStats) {
      return;
    }

    if (!isWebpackMultiStats(multiStats)) {
      multiStats = { stats: [ multiStats as webpack.Stats ] };
    }

    if (!multiConfig) {
      multiConfig = (multiStats as { stats: webpack.Stats[] }).stats.map(stats => {
        return stats.compilation.compiler.options;
      });
    } else if (!Array.isArray(multiConfig)) {
      multiConfig = [ multiConfig ];
    }

    (multiStats as { stats: webpack.Stats[] }).stats.forEach((stats, statsIndex) => {
      const config = (multiConfig as webpack.Configuration[])[statsIndex];

      logFn(stats, config);
    });
  };
}


export function addWebpackConfigurationDependency(
  config: webpack.Configuration & { dependencies?: string[] },
  dependency: webpack.Configuration,
): void {
  if (!config.dependencies) {
    config.dependencies = [];
  }

  if (dependency.name && config.dependencies.indexOf(dependency.name) === -1) {
    config.dependencies.push(dependency.name);
  }
}


export function applyPartialWebpackConfig(
  context: BuilderContext,
  webpackConfig: webpack.Configuration,
  partialWebpackConfig$: UdkPartialWebpackConfig | UdkPartialWebpackConfig[],
): Observable<webpack.Configuration> {
  if (Array.isArray(partialWebpackConfig$)) {
    return from(
      (partialWebpackConfig$ as UdkPartialWebpackConfig[])
        .reduce((acc: Promise<webpack.Configuration>, partialWebpackConfig) => {
          return acc.then(config => {
            return applyPartialWebpackConfig(
              context,
              config,
              partialWebpackConfig,
            ).toPromise();
          });
        }, Promise.resolve(webpackConfig)) as Observable<webpack.Configuration>,
    );
  }

  if (
    partialWebpackConfig$ && (
      typeof (partialWebpackConfig$ as Promise<UdkPartialWebpackConfig>).then === 'function'
  )) {
    partialWebpackConfig$ = from(
      partialWebpackConfig$ as Promise<UdkPartialWebpackConfig>,
    ) as UdkPartialWebpackConfig;
  } else if (
    !partialWebpackConfig$ || (
      typeof (partialWebpackConfig$ as Observable<UdkPartialWebpackConfig>).subscribe !== 'function'
  )) {
    partialWebpackConfig$ = of(partialWebpackConfig$) as UdkPartialWebpackConfig;
  }

  return (partialWebpackConfig$ as Observable<UdkPartialWebpackConfig>).pipe(
    concatMap((partialWebpackConfig) => {
      if (typeof partialWebpackConfig === 'string') {
        const partialWebpackConfigPath = getSystemPath(resolve(
          normalize(context.workspaceRoot),
          normalize(partialWebpackConfig),
        ));

        partialWebpackConfig = require(partialWebpackConfigPath);

        return applyPartialWebpackConfig(
          context,
          webpackConfig,
          partialWebpackConfig,
        );
      }

      if (typeof partialWebpackConfig === 'function') {
        return applyPartialWebpackConfig(
          context,
          webpackConfig,
          partialWebpackConfig(webpackConfig),
        );
      }

      if (typeof partialWebpackConfig === 'object' && partialWebpackConfig !== webpackConfig) {
        webpackConfig = webpackMerge(webpackConfig, partialWebpackConfig as webpack.Configuration);
      }

      return of(webpackConfig);
    }),
  );
}


export async function buildBrowserWebpackConfigs(
  options: BrowserBuilderSchema,
  context: BuilderContext,
  host: virtualFs.Host<fs.Stats>,
  supportDifferentialLoading: boolean,
): Promise<webpack.Configuration[]> {
  const buidlerNameOrigin = context.builder.builderName;

  if (supportDifferentialLoading) {
    // hack: trick generateWebpackConfig to support differential loading
    context.builder.builderName = 'browser';
  }

  const { config: configs } = await buildBrowserWebpackConfigFromContext(
    options,
    context,
    host,
  );

  // remove hack: restore builder name
  context.builder.builderName = buidlerNameOrigin;

  if (configs.length === 2) {
    // note: ts.ScriptTarget.ES5 is first entry
    //
    // tslint:disable-next-line: max-line-length
    // https://github.com/angular/angular-cli/blob/v8.0.0-rc.4/packages/angular_devkit/build_angular/src/utils/webpack-browser-config.ts#L63

    configs[0].name = 'browser-es5';
    configs[1].name = 'browser-es6';
  } else {
    configs[0].name = 'browser';
  }

  return configs;
}


export async function buildServerWebpackConfig(
  options: ServerBuilderOptions,
  context: BuilderContext,
  fileLoaderEmitFile: boolean,
  bundleDependenciesWhitelist?: string[],
): Promise<webpack.Configuration> {
  const { config: configs } = await generateBrowserWebpackConfigFromContext(
    {
      ...options,
      // index: '',
      buildOptimizer: false,
      aot: true,
      platform: 'server',
    } as NormalizedBrowserBuilderSchema,
    context,
    wco => [
      getCommonConfig(wco),
      getServerConfig(wco),
      getStylesConfig(wco),
      getStatsConfig(wco),
      getCompilerConfig(wco),
    ],
  );

  const serverConfig = configs[0];

  if (bundleDependenciesWhitelist) {
    const whitelistPatterns = ([] as string[])
      .concat(bundleDependenciesWhitelist || [])
      .map(whitelistPattern => new RegExp(whitelistPattern));

    const isWhitelisted: (request: string) => boolean = request => {
      for (const whitelistPattern of whitelistPatterns) {
        if (whitelistPattern.test(request)) {
          return true;
        }
      }

      return false;
    };

    // note(enten): angular server model declare an array with a function filter as second item.
    // We intercept its behavior. When that will break: that mean something
    // change related to angular server model.
    //
    // tslint:disable-next-line: max-line-length
    // @see https://github.com/angular/angular-cli/blob/v8.1.0-beta.2/packages/angular_devkit/build_angular/src/angular-cli-files/models/webpack-configs/server.ts#L40
    // tslint:disable-next-line: max-line-length
    const configExternals = serverConfig.externals as webpack.ExternalsFunctionElement[];
    const angularServerExternalsFn = configExternals[1];


    // tslint:disable-next-line: no-any
    configExternals[1] = (_, request, callback: (error?: any, result?: any) => void) => {
      if (isWhitelisted(request)) {
        callback();
      } else {
        angularServerExternalsFn(_, request, callback);
      }
    };
  }

  serverConfig.name = 'server';

  // fix: disable server config to emit assets
  setWebpackFileLoaderEmitFile(configs[0], fileLoaderEmitFile);

  return serverConfig;
}


export function createLoggingCallback(
  logger: logging.LoggerApi,
  options: {
    colors?: boolean;
    verbose?: boolean;
  } = {},
) {
  const logStats = (stats: webpack.Stats, config: webpack.Configuration) => {
    const statsToOptions = {
      ...config.stats as webpack.Stats.ToStringOptionsObject,
      colors: options.colors,
    };

    let statsJson: object;
    const getStatsJson = () => {
      if (!statsJson) {
        statsJson = stats.toJson(statsToOptions);
      }

      return statsJson;
    };

    const configName = stats.compilation.compiler.name;
    let statsTitle = '';
    if (configName) {
      statsTitle = 'Name: '
        + (options.colors ? terminal.bold(configName) : configName)
        + (options.verbose ? '\n' : '');
    }

    const statsString = options.verbose
      ? stats.toString(statsToOptions)
      : statsToString(getStatsJson(), statsToOptions);

    logger.info(statsTitle + statsString);

    if (!options.verbose) {
      if (stats.hasWarnings()) {
        logger.warn(statsWarningsToString(getStatsJson(), statsToOptions));
      }

      if (stats.hasErrors()) {
        logger.error(statsErrorsToString(getStatsJson(), statsToOptions));
      }
    }

    logger.info('');
  };

  return adaptWebpackLoggingCallback(logStats);
}


export function createUniversalBuilderOutput(
  udkOptions: json.JsonObject & BuildUdkSchema,
  browserOptions: json.JsonObject & BrowserBuilderSchema,
  serverOptions: json.JsonObject & ServerBuilderOptions,
  multiStats: webpack.Stats | { stats: webpack.Stats[] },
  multiConfig: webpack.Configuration | webpack.Configuration[],
): UdkBuilderOutput {
  const result: UdkBuilderOutput = {
    success: !!multiStats && !(multiStats as { hasErrors(): boolean }).hasErrors(),
    udkOptions,
    browserOptions,
    serverOptions,
    browserES5EmittedFiles: [],
    browserES6EmittedFiles: [],
    browserFiles: [],
    browserModuleFiles: [],
    browserNoModuleFiles: [],
    serverEmittedFiles: [],
  };

  if (!multiStats) {
    return result;
  }

  if (!isWebpackMultiStats(multiStats)) {
    multiStats = { stats: [ multiStats as {} as webpack.Stats ] };
  }

  if (!multiConfig) {
    multiConfig = (multiStats as { stats: webpack.Stats[] }).stats.map(stats => {
      return stats.compilation.compiler.options;
    });
  } else if (!Array.isArray(multiConfig)) {
    multiConfig = [ multiConfig as {} as webpack.Configuration ];
  }

  (multiStats as { stats: webpack.Stats[] }).stats.forEach((stats, statsIndex) => {
    const config = (multiConfig as webpack.Configuration[])[statsIndex];

    // Collect server emitted files
    if (config.target === 'node') {
      result.serverEmittedFiles = getEmittedFiles(stats.compilation) as UdkBuilderEmittedFile[];
    // Collect browser es5 emitted files
    } else if (statsIndex === 0) {
      result.browserES5EmittedFiles = getEmittedFiles(stats.compilation) as UdkBuilderEmittedFile[];
    // Collect browser es6 emitted files
    } else if (statsIndex === 1) {
      result.browserES6EmittedFiles = getEmittedFiles(stats.compilation) as UdkBuilderEmittedFile[];
    // If code below run, it's mean that devkit has changed and generates more browser configs
    } else {
      throw new Error('BREAKING CHANGE DETECTED! Universal config must have 2 or 3 childs');
    }
  });

  // note(enten): check url below to understand next if-else block
  // tslint:disable-next-line: max-line-length
  // https://github.com/angular/angular-cli/blob/v8.1.0-beta.2/packages/angular_devkit/build_angular/src/browser/index.ts#L240
  if ((multiStats as { stats: webpack.Stats[] }).stats.length === 3) {
    result.browserNoModuleFiles = result.browserES5EmittedFiles;
    result.browserModuleFiles = result.browserES6EmittedFiles;
    result.browserFiles = result.browserES6EmittedFiles.filter(x => x.extension === '.css');
  } else {
    const emittedFiles = result.browserES5EmittedFiles;
    result.browserFiles = emittedFiles.filter(x => x.name !== 'polyfills-es5');
    result.browserNoModuleFiles = emittedFiles.filter(x => x.name === 'polyfills-es5');
  }

  return result;
}


export function isTerminalColorsEnabled(socket?: NodeJS.Socket) {
  return terminal.getCapabilities(socket || process.stdout).colors;
}


export function isWebpackMultiStats(stats: webpack.Stats | { stats: webpack.Stats[] }): boolean {
  return !!stats && ('stats' in (stats as { stats: webpack.Stats[] }));
}


export function createWebpackUniversalConfig(
  serverConfig: webpack.Configuration,
  browserConfigs: webpack.Configuration | webpack.Configuration[],
): webpack.Configuration[] {
  if (!Array.isArray(browserConfigs)) {
    browserConfigs = [ browserConfigs ];
  }

  const universalConfig: webpack.Configuration[] = [];
  let previousBrowserConfig: webpack.Configuration | null = null;

  for (
    let browserConfigIndex = 0;
    browserConfigIndex < browserConfigs.length;
    ++browserConfigIndex
  ) {
    const browserConfig = browserConfigs[browserConfigIndex];

    if (!browserConfig.name) {
      browserConfig.name = 'browser' + (browserConfigIndex || '');
    }

    if (previousBrowserConfig) {
      addWebpackConfigurationDependency(browserConfig, previousBrowserConfig);
    }

    addWebpackConfigurationDependency(serverConfig, browserConfig);

    universalConfig.push(browserConfig);

    previousBrowserConfig = browserConfig;
  }

  if (!serverConfig.name) {
    serverConfig.name = 'server';
  }

  universalConfig.push(serverConfig);

  return universalConfig;
}


export function deleteConfigOutputPath(
  root: string,
  host: virtualFs.Host<fs.Stats>,
  config: webpack.Configuration,
) {
  if (!config.output || !config.output.path) {
    return Promise.resolve();
  }

  return deleteOutputDir(
    normalize(root),
    normalize(config.output.path),
    host,
  ).toPromise();
}


export function getCompilerConfig(wco: WebpackConfigOptions): webpack.Configuration {
  if (wco.buildOptions.main || wco.buildOptions.polyfills) {
    return wco.buildOptions.aot ? getAotConfig(wco) : getNonAotConfig(wco);
  }

  return {};
}


export function getProjectName(
  context: BuilderContext,
  workspace: experimental.workspace.Workspace,
): string | null {
  return context.target
    ? context.target.project
    : workspace.getDefaultProjectName();
}


export function makeTargetSpecifier(
  targetSpecString: string,
  defaultSpec?: Target,
): Target {
  let [
    project,
    target,
    configuration,
  ]: string[] = targetSpecString ? targetSpecString.split(':') : [];

  if (defaultSpec) {
    if (!project && defaultSpec.project) {
      project = defaultSpec.project;
    }

    if (!target && defaultSpec.target) {
      target = defaultSpec.target;
    }

    if (!configuration && defaultSpec.configuration) {
      configuration = defaultSpec.configuration;
    }
  }

  return {
    project,
    configuration,
    target,
  };
}


export function setWebpackFileLoaderEmitFile(
  webpackConfig: webpack.Configuration,
  value: boolean,
  fileLoaderName = 'file-loader',
): void {
  const fileLoader = webpackConfig.module
    && webpackConfig.module.rules
    && webpackConfig.module.rules.find(rule => rule.loader === fileLoaderName);

  if (fileLoader) {
    if (fileLoader.options) {
      (fileLoader.options as { emitFile: boolean }).emitFile = value;
    } else {
      fileLoader.options = { emitFile: value };
    }
  }
}
