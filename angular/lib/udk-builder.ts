// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import * as fs from 'fs';
import * as path from 'path';

import { BuilderContext, createBuilder, targetFromTargetString } from '@angular-devkit/architect';
import { ExecutionTransformer, FileReplacement } from '@angular-devkit/build-angular';

import {
  ArchitectPlugin,
  WebpackFactory,
  WebpackLoggingCallback,
} from '@angular-devkit/build-webpack';

import {
  Path,
  experimental,
  getSystemPath,
  join,
  json,
  normalize,
  resolve,
  schema,
  virtualFs,
} from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

import { Observable, from, of } from 'rxjs';
import { catchError, concatMap, mapTo, switchMap } from 'rxjs/operators';

import { ScriptTarget } from 'typescript';

import webpack = require('webpack');
import webpackMerge = require('webpack-merge');

import udk = require('../../lib/index');

import {
  BrowserBuilderSchema,
  BuildBrowserFeatures,
  ServerBuilderSchema,
  UdkBuilderOutput,
  Version,
  adaptWebpackLoggingCallback,
  applyPartialWebpackConfig,
  augmentAppWithServiceWorker,
  buildBrowserWebpackConfigs,
  buildServerWebpackConfig,
  createLoggingCallback,
  createUniversalBuilderOutput,
  createWebpackUniversalConfig,
  deleteConfigOutputPath,
  getProjectName,
  isTerminalColorsEnabled,
  readTsconfig,
  writeIndexHtml,
} from './ng-devkit';
import { BuildUdkSchema } from './schema';


export function buildUniversal(
  options: BuildUdkSchema,
  context: BuilderContext,
  transforms: {
    logging?: WebpackLoggingCallback;
    webpackConfiguration?: ExecutionTransformer<webpack.Configuration>;
    webpackFactory?: WebpackFactory;
  } = {},
) {
  // Check Angular version.
  Version.assertCompatibleAngularVersion(context.workspaceRoot);

  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);

  const host = new NodeJsSyncHost();
  let projectRoot: Path;

  const initialize = async () => {
    const workspace = await experimental.workspace.Workspace.fromPath(
      host,
      normalize(context.workspaceRoot),
      registry,
    );

    const projectName = getProjectName(context, workspace);

    if (!projectName) {
      throw new Error('Must either have a target from the context or a default project.');
    }

    projectRoot = resolve(
      normalize(context.workspaceRoot),
      normalize(workspace.getProject(projectName).root),
    );

    const workspaceRoot = getSystemPath(normalize(context.workspaceRoot));
    const browserTarget = targetFromTargetString(options.browserTarget);
    const browserOptions = await context.getTargetOptions(browserTarget);
    const tsConfigPath = path.resolve(
      workspaceRoot,
      (browserOptions as {} as BrowserBuilderSchema).tsConfig,
    );
    const tsConfig = readTsconfig(tsConfigPath);

    const ts = await import('typescript');

    // At the moment, only the browser builder supports differential loading
    // However this config generation is used by multiple builders such as dev-server
    const scriptTarget = tsConfig.options.target || ts.ScriptTarget.ES5;
    const buildBrowserFeatures = new BuildBrowserFeatures(projectRoot, scriptTarget);

    if (
      buildBrowserFeatures.isEs5SupportNeeded()
      && tsConfig.options.target !== ScriptTarget.ES5
      && tsConfig.options.target !== ScriptTarget.ES2015
    ) {
      context.logger.warn(
        'WARNING: Using differential loading with targets ES5 and ES2016 or higher may'
        + '\ncause problems. Browsers with support for ES2015 will load the ES2016+ scripts'
        + '\nreferenced with script[type="module"] but they may not support ES2016+ syntax.',
      );
    }

    return buildUniversalConfig(options, context, host, true, transforms.webpackConfiguration);
  };

  return from(initialize()).pipe(
    switchMap(({ browserOptions, serverOptions, config }) => runMultiCompiler(
      options,
      browserOptions,
      serverOptions,
      projectRoot,
      context,
      host,
      config,
      transforms,
    )),
  );
}

export async function buildUniversalConfig(
  options: BuildUdkSchema,
  context: BuilderContext,
  host: virtualFs.Host<fs.Stats>,
  supportDifferentialLoading: boolean,
  webpackConfigurationTransform?: ExecutionTransformer<webpack.Configuration>,
): Promise<{
  browserOptions: BrowserBuilderSchema,
  serverOptions: ServerBuilderSchema,
  config: webpack.Configuration[];
}> {
  if (options.main) {
    context.logger.warn('--');
    context.logger.warn('[udk] WARNING! the udk builder option `main` is temporary disabled');
    context.logger.warn('[udk] The `serverTarget.main` option is use as the main server entrypoint'); // tslint:disable-line:max-line-length
    context.logger.warn('[udk] Your server entry point probably need a refactoring');
    context.logger.warn('[udk] Check for boilerplate example: https://github.com/enten/angular-universal'); // tslint:disable-line:max-line-length
    context.logger.warn('--');
  }

  const overrides = {
    deleteOutputPath: !!options.deleteOutputPath,
    verbose: !!options.verbose,
  };

  const browserTarget = targetFromTargetString(options.browserTarget);
  const browserName = await context.getBuilderNameForTarget(browserTarget);
  const browserOptionsRaw = await context.getTargetOptions(browserTarget);
  const browserOptions = await context.validateOptions<json.JsonObject & BrowserBuilderSchema>(
    { ...browserOptionsRaw, ...overrides },
    browserName,
  );

  const serverTarget = targetFromTargetString(options.serverTarget);
  const serverName = await context.getBuilderNameForTarget(serverTarget);
  const serverOptionsRaw = await context.getTargetOptions(serverTarget);
  const serverOptions = await context.validateOptions<json.JsonObject & ServerBuilderSchema>(
    { ...serverOptionsRaw, ...overrides },
    serverName,
  );

  // builders fileReplacements must be able to be merged with udk fileReplacements
  browserOptions.fileReplacements = ([] as FileReplacement[]).concat(
    browserOptions.fileReplacements || [],
    options.fileReplacements || [],
  );
  serverOptions.fileReplacements = ([] as FileReplacement[]).concat(
    serverOptions.fileReplacements || [],
    options.fileReplacements || [],
  );

  const browserConfigs = await buildBrowserWebpackConfigs(
    browserOptions,
    context,
    host,
    supportDifferentialLoading,
  );

  const serverConfig: webpack.Configuration = await buildServerWebpackConfig(
    serverOptions,
    context,
    !!options.fileLoaderEmitFile,
    options.bundleDependenciesWhitelist,
  );

  const browserConfigsTransformed: webpack.Configuration[] = [];
  let serverConfigTransformed: webpack.Configuration;

  for (const browserConfig of browserConfigs) {
    browserConfigsTransformed.push(
      await applyPartialWebpackConfig(context, browserConfig, [
        webpackConfigurationTransform,
        options.partialBrowserConfig,
      ]).toPromise(),
    );
  }

  serverConfigTransformed = await applyPartialWebpackConfig(context, serverConfig, [
    webpackConfigurationTransform,
    options.partialServerConfig,
  ]).toPromise();

  const config = createWebpackUniversalConfig(
    serverConfigTransformed,
    browserConfigs,
  );

  return {
    browserOptions,
    serverOptions,
    config,
  };
}


function runMultiCompiler(
  options: BuildUdkSchema,
  browserOptions: BrowserBuilderSchema,
  serverOptions: ServerBuilderSchema,
  projectRoot: Path,
  context: BuilderContext,
  host: virtualFs.Host<fs.Stats>,
  multiConfig: webpack.Configuration[],
  transforms: {
    logging?: WebpackLoggingCallback;
    webpackFactory?: WebpackFactory;
  } = {},
): Observable<UdkBuilderOutput> {
  const root = normalize(context.workspaceRoot);

  const createWebpack = (
    transforms.webpackFactory || (config => of(udk(config)))
  ) as (config: webpack.Configuration[]) => Observable<webpack.MultiCompiler>;
  const logStats: WebpackLoggingCallback = transforms.logging
    ? adaptWebpackLoggingCallback(transforms.logging)
    : createLoggingCallback(context.logger, {
        verbose: options.verbose,
        colors: isTerminalColorsEnabled(),
      });

  const initialize: () => Promise<webpack.MultiCompiler> = async () => {
    if (options.deleteOutputPath) {
      await Promise.all(multiConfig.map(config => deleteConfigOutputPath(
        context.workspaceRoot,
        host,
        config,
      )));
    }

    multiConfig = multiConfig.map(c => webpackMerge(c, {
      plugins: [
        new ArchitectPlugin(context),
      ],
    }));

    return createWebpack(multiConfig).toPromise();
  };

  return from(initialize()).pipe(
    switchMap(webpackCompiler => new Observable<UdkBuilderOutput>(obs => {
      const callback: webpack.Compiler.Handler = (err, multiStats) => {
        if (err) {
          return obs.error(err);
        }

        logStats(multiStats, multiConfig as {} as webpack.Configuration);

        const builderOutput = createUniversalBuilderOutput(
          options as json.JsonObject & BuildUdkSchema,
          browserOptions as json.JsonObject & BrowserBuilderSchema,
          serverOptions as json.JsonObject & ServerBuilderSchema,
          multiStats,
          multiConfig,
        );

        obs.next(builderOutput);
        obs.complete();
      };

      try {
        webpackCompiler.run(callback);
      } catch (err) {
        if (err) {
          context.logger.error(`\nAn error occurred during the build:\n${err && err.stack || err}`);
        }

        obs.next({ success: false } as UdkBuilderOutput);
        obs.complete();
      }
    })),
    concatMap((builderOutput) => {
      const withDifferentialLoading = multiConfig.length > 2;

      if (!builderOutput.success || !browserOptions.index || !withDifferentialLoading) {
        return of(builderOutput);
      }

      // For differential loading, the builder needs to created the index.html by itself
      return writeIndexHtml({
        host,
        outputPath: join(root, browserOptions.outputPath),
        indexPath: join(root, browserOptions.index),
        files: builderOutput.browserFiles,
        noModuleFiles: builderOutput.browserNoModuleFiles,
        moduleFiles: builderOutput.browserModuleFiles,
        baseHref: browserOptions.baseHref,
        deployUrl: browserOptions.deployUrl,
        sri: browserOptions.subresourceIntegrity,
        scripts: browserOptions.scripts,
        styles: browserOptions.styles,
      }).pipe(
        mapTo(builderOutput),
        catchError(err => {
          context.logger.error(
            `\nAn error occurred during write index:\n${err && err.stack || err}`,
          );

          return of({ ...builderOutput, success: false } as UdkBuilderOutput);
        }),
      );
    }),
    concatMap((builderOutput: UdkBuilderOutput) => {
      if (!builderOutput.success || !browserOptions.serviceWorker) {
        return of(builderOutput);
      }

      return from(augmentAppWithServiceWorker(
        host,
        root,
        projectRoot,
        resolve(root, normalize(browserOptions.outputPath)),
        browserOptions.baseHref || '/',
        browserOptions.ngswConfigPath,
      )).pipe(
        mapTo(builderOutput),
        catchError(err => {
          context.logger.error(
            `\nAn error occurred during write service worker:\n${err && err.stack || err}`,
          );

          return of({ ...builderOutput, success: false } as UdkBuilderOutput);
        }),
      );
    }),
  );
}

export default createBuilder<json.JsonObject & BuildUdkSchema, UdkBuilderOutput>(buildUniversal);
