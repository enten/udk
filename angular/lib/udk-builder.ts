// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import {
  Path,
  getSystemPath,
  normalize,
  resolve,
  virtualFs,
} from '@angular-devkit/core';
import * as terminalCapabilities from '@angular-devkit/core/src/terminal/caps';

import {
  Builder,
  BuilderConfiguration,
  BuilderContext,
} from '@angular-devkit/architect';

import {
  AssetPattern,
  AssetPatternObject,
  BrowserBuilder,
  BrowserBuilderSchema,
  NormalizedBrowserBuilderSchema,
  ServerBuilder,
} from '@angular-devkit/build-angular';
import { BuildWebpackServerSchema } from '@angular-devkit/build-angular/src/server/schema';
import { NormalizedFileReplacement } from '@angular-devkit/build-angular/src/utils';
const buildAngularUtils = require('@angular-devkit/build-angular/src/utils');

import {
  statsErrorsToString,
  statsToString,
  statsWarningsToString,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/stats';

import rimraf = require('rimraf');
import webpackMerge = require('webpack-merge');

import {
  Observable,
  from as fromPromise,
  of as observableOf,
  zip,
} from 'rxjs';
import { concatMap, map } from 'rxjs/operators';

import * as fs from 'fs';
import udk = require('udk');
import * as webpack from 'webpack';

// tslint:disable-next-line:max-line-length
import * as webpackConfigsUtils from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/utils';

import { NG_DEVKIT_0_12 } from './versions';

// support @angular-devkit/build-angular v0.7.0 (e5d68c19)
let getWebpackStatsConfig: (verbose?: boolean) => {
  colors: boolean;
  hash: boolean;
  timings: boolean;
  chunks: boolean;
  chunkModules: boolean;
  children: boolean;
  modules: boolean;
  reasons: boolean;
  warnings: boolean;
  errors: boolean;
  assets: boolean;
  version: boolean;
  errorDetails: boolean;
  moduleTrace: boolean;
};

if (!(webpackConfigsUtils as any).getWebpackStatsConfig) { // tslint:disable-line:no-any
  // tslint:disable-next-line:max-line-length
  getWebpackStatsConfig = require('@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/stats').getWebpackStatsConfig;
}

// support @angular-devkit/build-angular v0.7.0-rc.2
const {
  addFileReplacements,
  normalizeAssetPatterns,
  normalizeFileReplacements,
  normalizeOptimization,
  normalizeSourceMaps,
} = buildAngularUtils as any; // tslint:disable-line:no-any

function supportFileReplacement(
  options: { fileReplacements: FileReplacement[] },
  root: Path,
  host: virtualFs.Host,
  fileReplacements: FileReplacement[],
): Observable<void> {
  // <= v0.7.0-rc.1
  if (addFileReplacements) {
    options.fileReplacements = fileReplacements;

    // Note: This method changes the file replacements in host.
    return addFileReplacements(root, host, fileReplacements);
  }

  // >= angular/cli v7.2 (>= angular-devkit/build-angular v0.12)
  if (NG_DEVKIT_0_12) {
    host = new virtualFs.SyncDelegateHost(host) as {} as virtualFs.Host;
  }

  let normalizedFileReplacements = normalizeFileReplacements(
    fileReplacements,
    host,
    root,
  ) as Observable<NormalizedFileReplacement[]>;

  // >= v0.12.0
  if (Array.isArray(normalizedFileReplacements)) {
    normalizedFileReplacements = observableOf(
      normalizedFileReplacements as NormalizedFileReplacement[],
    );
  }

  return normalizedFileReplacements.pipe(
    map((fileReplacements: FileReplacement[]) => {
      options.fileReplacements = fileReplacements;
    }),
  );
}

// support @angular-devkit/build-angular v0.12.0
function supportAssetPatterns(
  options: { assets: AssetPattern[] },
  root: Path,
  projectRoot: Path,
  host: virtualFs.Host,
  assetPatterns: AssetPattern[],
  maybeSourceRoot: Path | undefined,
): Observable<void> {
  // >= angular/cli v7.2 (>= angular-devkit/build-angular v0.12)
  if (NG_DEVKIT_0_12) {
    host = new virtualFs.SyncDelegateHost(host) as {} as virtualFs.Host;
  }

  let normalizedAssetPatterns = (
    options.assets
      ? normalizeAssetPatterns(assetPatterns, host, root, projectRoot, maybeSourceRoot)
      : observableOf(null)
  ) as Observable<AssetPatternObject[]>;

  // >= v0.12.0
  if (Array.isArray(normalizedAssetPatterns)) {
    normalizedAssetPatterns = observableOf(normalizedAssetPatterns as AssetPatternObject[]);
  }

  return normalizedAssetPatterns.pipe(
    // Replace the assets in options with the normalized version.
    map(assetPatternObjects => {
      if (assetPatternObjects) {
        options.assets = assetPatternObjects;
      }
    }),
  );
}

import { BuildUdkSchema, FileReplacement } from './schema';

export type BuildWebpackSchema = BrowserBuilderSchema | BuildWebpackServerSchema;

export interface BuilderStatic<Builder> {
  new(context: BuilderContext): Builder;
}

export default class UdkBuilder implements Builder<BuildUdkSchema> {
  constructor(public context: BuilderContext) { }

  run(builderConfig: BuilderConfiguration<BuildUdkSchema>) {
    let builderConfigs: (BuilderConfiguration<BrowserBuilderSchema | BuildWebpackServerSchema>)[];
    let webpackConfigs: webpack.Configuration[];

    return this.buildWebpackConfig(builderConfig.options).pipe(
      concatMap((configs) => new Observable<{ success: boolean }>(obs => {
        builderConfigs = configs.builderConfigs;
        webpackConfigs = configs.webpackConfigs;

        const multiConfig = webpackConfigs;

        if (builderConfig.options.deleteOutputPath) {
          this._deleteOutputPath(multiConfig);
        }

        try {
          const webpackCompiler = udk(multiConfig) as webpack.MultiCompiler;

          webpackCompiler.run((err, stats) => {
            if (err) {
              return obs.error(err);
            }

            this._printStats(stats, builderConfig.options.verbose);

            obs.next({ success: !stats.hasErrors() });
            obs.complete();
          });
        } catch (err) {
          if (err) {
            this.context.logger.error(
              '\nAn error occured during the build:\n' + ((err && err.stack) || err));
          }
          throw err;
        }
      })),
      concatMap(buildEvent => {
        // browser builder
        const builderConfig = builderConfigs[0] as BuilderConfiguration<BrowserBuilderSchema>;
        const { options } = builderConfig;

        // tslint:disable-next-line:no-any
        if (buildEvent.success && !options.watch && options.serviceWorker) {
          const { root } = this.context.workspace;
          const projectRoot = resolve(root, builderConfig.root);

          // tslint:disable-next-line:max-line-length
          const { augmentAppWithServiceWorker } = require('@angular-devkit/build-angular/src/angular-cli-files/utilities/service-worker');

          return new Observable<{ success: boolean }>(obs => {
            augmentAppWithServiceWorker(
              this.context.host,
              root,
              projectRoot,
              resolve(root, normalize(options.outputPath)),
              options.baseHref || '/',
              options.ngswConfigPath,
            ).then(
              () => {
                obs.next({ success: true });
                obs.complete();
              },
              (err: Error) => {
                obs.error(err);
              },
            );
          });
        } else {
          return observableOf(buildEvent);
        }
      }),
    );
  }

  buildWebpackConfig(options: BuildUdkSchema): Observable<{
    builderConfigs: (BuilderConfiguration<BrowserBuilderSchema | BuildWebpackServerSchema>)[],
    webpackConfigs: webpack.Configuration[],
  }> {
    const {
      main,
      browserTarget,
      serverTarget,
      partialBrowserConfig,
      partialServerConfig,
      fileReplacements,
    } = options;

    if (main) {
      console.warn('--');
      console.warn('[udk] WARNING! the udk builder option `main` is temporary disabled');
      console.warn('[udk] The `serverTarget.main` option is use as the main server entrypoint');
      console.warn('[udk] Your server entry point probably need a refactoring');
      console.warn('[udk] Check for boilerplate example: https://github.com/enten/angular-universal'); // tslint:disable-line:max-line-length
      console.warn('--');
    }

    return zip(
      this._getWebpackConfigForBuilder(
        BrowserBuilder,
        browserTarget,
        partialBrowserConfig,
        fileReplacements,
      ),
      this._getWebpackConfigForBuilder(
        ServerBuilder,
        serverTarget,
        partialServerConfig,
        fileReplacements,
      ),
    ).pipe(
      map(configs => {
        const builderConfigs = configs.map(({ builderConfig }) => builderConfig);
        const webpackConfigs = configs.map(({ webpackConfig }) => webpackConfig);

        const [
          browserConfig,
          serverConfig,
        ] = webpackConfigs;

        if (!browserConfig.name) {
          browserConfig.name = 'browser';
        }

        if (!webpackConfigs[1].name) {
          serverConfig.name = 'server';
        }

        // set browserConfig as serverConfig's dependency
        (serverConfig as {} as { dependencies: string[] }).dependencies = [ browserConfig.name ];

        return {
          builderConfigs,
          webpackConfigs,
        };
      }),
    );
  }

  _applyPartialWebpackConfig(
    webpackConfig: webpack.Configuration,
    partialWebpackConfig$: any, // tslint:disable-line:no-any
  ): Observable<webpack.Configuration> {
    if (partialWebpackConfig$ && typeof partialWebpackConfig$.then === 'function') {
      partialWebpackConfig$ = fromPromise(partialWebpackConfig$);
    } else if (!partialWebpackConfig$ || typeof partialWebpackConfig$.subscribe !== 'function') {
      partialWebpackConfig$ = observableOf(partialWebpackConfig$);
    }

    return partialWebpackConfig$.pipe(
      concatMap((partialWebpackConfig) => {
        if (typeof partialWebpackConfig === 'string') {
          const partialWebpackConfigPath = getSystemPath(resolve(
            this.context.workspace.root,
            normalize(partialWebpackConfig),
          ));

          partialWebpackConfig = require(partialWebpackConfigPath);
        }

        if (typeof partialWebpackConfig === 'function') {
          return this._applyPartialWebpackConfig(
            webpackConfig,
            (partialWebpackConfig as any)(webpackConfig), // tslint:disable-line:no-any
          );
        }

        if (typeof partialWebpackConfig === 'object') {
          webpackConfig = webpackMerge(webpackConfig, partialWebpackConfig);
        }

        return observableOf(webpackConfig);
      }),
    );
  }

  _getBuilderConfig(projectTarget: string) {
    const architect = this.context.architect;
    const [ project, target, configuration ] = projectTarget.split(':');
    // Override browser build watch setting.
    // const overrides = { watch: options.watch };
    const targetSpec = { project, target, configuration/*, overrides*/ };
    const builderConfig = architect.getBuilderConfiguration<BuildWebpackSchema>(targetSpec);

    return architect.getBuilderDescription(builderConfig).pipe(
      concatMap(builderDescription => {
        return architect.validateBuilderOptions(builderConfig, builderDescription);
      }),
    );
  }

  _deleteOutputPath(webpackConfig: webpack.Configuration | webpack.Configuration[]) {
    if (Array.isArray(webpackConfig)) {
      return webpackConfig.forEach((c) => {
        this._deleteOutputPath(c);
      });
    }

    if (webpackConfig.output && webpackConfig.output.path) {
      rimraf.sync(webpackConfig.output.path);
    }
  }

  _getWebpackConfigForBuilder(
    BuilderCtor: BuilderStatic<BrowserBuilder | ServerBuilder>,
    projectTarget: string,
    partialWebpackConfig: any, // tslint:disable-line:no-any
    fileReplacements: FileReplacement[] = [],
  ): Observable<{
    builderConfig: BuilderConfiguration<BrowserBuilderSchema | BuildWebpackServerSchema>,
    webpackConfig: webpack.Configuration,
  }> {
    const { root } = this.context.workspace;
    const host = new virtualFs.AliasHost(this.context.host);

    let options: BuildWebpackSchema;
    let projectRoot: Path;
    let builderConfig: BuilderConfiguration<BuildWebpackSchema>;

    return this._getBuilderConfig(projectTarget).pipe(
      concatMap((_builderConfig) => {
        builderConfig = _builderConfig;

        options = builderConfig.options;
        projectRoot = resolve(root, builderConfig.root);
        // browser or server fileReplacements must be able to be override by udk fileReplacements
        fileReplacements = ([] as FileReplacement[]).concat(
          options.fileReplacements || [],
          fileReplacements,
        );

        // compat with angular-cli commit 4f8a5b7a changes
        if (typeof normalizeOptimization === 'function') {
          options.optimization = normalizeOptimization(options.optimization);
        }

        // compat with angular-cli commit 8516d682 changes
        if (typeof normalizeSourceMaps === 'function') {
          options.sourceMap = normalizeSourceMaps(options.sourceMap);
        }

        return observableOf(null);
      }),
      concatMap(() => supportFileReplacement(options, root, host, fileReplacements)),
      concatMap(() => supportAssetPatterns(
        (options as BrowserBuilderSchema),
        root,
        projectRoot,
        host,
        (options as BrowserBuilderSchema).assets,
        builderConfig.sourceRoot,
      )),
      concatMap(() => {
        const builder = new BuilderCtor(this.context);
        let webpackConfig: webpack.Configuration;

        webpackConfig = (builder as BrowserBuilder).buildWebpackConfig(
          root,
          projectRoot,
          host as virtualFs.Host<fs.Stats>,
          options as NormalizedBrowserBuilderSchema,
        );

        // fix: disable server builder to emit assets
        if (BuilderCtor === ServerBuilder && webpackConfig.module && webpackConfig.module.rules) {
          const fileLoader = webpackConfig.module.rules.find(rule => rule.loader === 'file-loader');

          if (fileLoader) {
            if (fileLoader.options) {
              // tslint:disable-next-line:no-any
              (fileLoader.options as { [k: string]: any }).emitFile = false;
            } else {
              fileLoader.options = { emitFile: false };
            }
          }
        }

        return this._applyPartialWebpackConfig(webpackConfig, partialWebpackConfig);
      }),
      map(webpackConfig => ({
        builderConfig,
        webpackConfig,
      })),
    );
  }

  _printStats(stats: webpack.Stats, verbose?: boolean) {
    if (Array.isArray((stats as any).stats)) { // tslint:disable-line:no-any
      return (stats as any).stats.forEach((s: webpack.Stats) => { // tslint:disable-line:no-any
        this._printStats(s, verbose);
      });
    }

    const statsConfig = getWebpackStatsConfig(verbose);
    statsConfig.colors = terminalCapabilities.stdout.colors;

    const compilationName = (stats.compilation as {} as { name: string }).name;
    const statsTitle = 'Child: ' + compilationName + (verbose ? '\n' : '');

    if (verbose) {
      const jsonString = stats.toString(statsConfig)
        .split('\n')
        .map(line => '  ' + line)
        .join('\n');

      this.context.logger.info(statsTitle + jsonString);
    } else {
      const json = stats.toJson(statsConfig);
      const jsonString = statsToString(json, statsConfig)
        .split('\n')
        .map(line => '  ' + line)
        .join('\n');

      this.context.logger.info(statsTitle + jsonString);
      if (stats.hasWarnings()) {
        this.context.logger.warn(statsWarningsToString(json, statsConfig));
      }
      if (stats.hasErrors()) {
        this.context.logger.error(statsErrorsToString(json, statsConfig));
      }
    }
  }
}
