// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import * as fs from 'fs';
import * as path from 'path';

import { Observable, TeardownLogic } from 'rxjs';
import { ScriptTarget } from 'typescript';
import webpack = require('webpack');

import { BuilderContext, targetFromTargetString } from '@angular-devkit/architect';
import { BuildResult, EmittedFiles, WebpackLoggingCallback } from '@angular-devkit/build-webpack';
import { join, json, logging, normalize, tags, terminal, virtualFs } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

// #region build-angular imports

import {
  getAotConfig,
  getCommonConfig,
  getOutputHashFormat,
  getServerConfig,
  getStatsConfig,
  getStylesConfig,
  normalizeExtraEntryPoints,
} from '@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs';
import {
  IndexHtmlTransform,
  writeIndexHtml,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/index-file/write-index-html';
import {
  readTsconfig,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/read-tsconfig';
import {
  augmentAppWithServiceWorker,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/service-worker';
import {
  generateBuildStats,
  generateBundleStats,
  statsErrorsToString,
  statsToString,
  statsWarningsToString,
} from '@angular-devkit/build-angular/src/angular-cli-files/utilities/stats';
import {
  BrowserBuilderOutput,
  buildBrowserWebpackConfigFromContext,
} from '@angular-devkit/build-angular/src/browser';
import {
  ServerBuilderOutput,
} from '@angular-devkit/build-angular/src/server';
import {
  ExecutionTransformer,
} from '@angular-devkit/build-angular/src/transforms';
import {
  BundleActionExecutor,
} from '@angular-devkit/build-angular/src/utils/action-executor';
import {
  BuildBrowserFeatures,
} from '@angular-devkit/build-angular/src/utils/build-browser-features';
import { findCachePath } from '@angular-devkit/build-angular/src/utils/cache-path';
import {
  copyAssets,
} from '@angular-devkit/build-angular/src/utils/copy-assets';
import {
  deleteOutputDir,
} from '@angular-devkit/build-angular/src/utils/delete-output-dir';
import {
  cachingDisabled,
} from '@angular-devkit/build-angular/src/utils/environment-options';
import {
  i18nInlineEmittedFiles,
} from '@angular-devkit/build-angular/src/utils/i18n-inlining';
import {
  normalizeAssetPatterns,
} from '@angular-devkit/build-angular/src/utils/normalize-asset-patterns';
import {
  NormalizedBrowserBuilderSchema,
} from '@angular-devkit/build-angular/src/utils/normalize-builder-schema';
import {
  normalizeOptimization,
} from '@angular-devkit/build-angular/src/utils/normalize-optimization';
import {
  normalizeSourceMaps,
} from '@angular-devkit/build-angular/src/utils/normalize-source-maps';
import {
  ensureOutputPaths,
} from '@angular-devkit/build-angular/src/utils/output-paths';
import {
  InlineOptions,
  ProcessBundleFile,
  ProcessBundleOptions,
  ProcessBundleResult,
} from '@angular-devkit/build-angular/src/utils/process-bundle';
import {
  generateI18nBrowserWebpackConfigFromContext,
  getIndexInputFile,
  getIndexOutputFile,
} from '@angular-devkit/build-angular/src/utils/webpack-browser-config';
import { getEmittedFiles } from '@angular-devkit/build-webpack/src/utils';

// #endregion build-angular imports

// #region local imports

import { requireModule } from '../../../lib/util/requireModule';
import PostcssCliResources from './postcss-cli-resources.server';
import {
  BrowserBuilderInitContext,
  BrowserBuilderOptions,
  ServerBuilderInitContext,
  ServerBuilderOptions,
  UniversalBuildOptions,
  UniversalCompilationOutput,
  UniversalTargetOptionsMap,
} from './types';

// #endregion local imports

// #region exports from build-angular

// source: master/packages/angular_devkit/build_angular/src/browser/index.ts#L74
export const cacheDownlevelPath = cachingDisabled ? undefined : findCachePath('angular-build-dl');

// #endregion exports from build-angular

// #region options utils

export async function getUniversalTargetOptions<K extends keyof UniversalTargetOptionsMap>(
  context: BuilderContext,
  options: UniversalBuildOptions,
  platformTarget: K,
): Promise<UniversalTargetOptionsMap[K]> {
  const optionsOverrides = {
    deleteOutputPath: !!options.deleteOutputPath,
    verbose: !!options.verbose,
  } as Partial<UniversalTargetOptionsMap[K]>;

  const targetString = platformTarget === 'server' ? options.serverTarget : options.browserTarget;

  // get platform target options
  const platformOptions = await validateTargetOptions<UniversalTargetOptionsMap[K]>(
    context,
    targetString,
    optionsOverrides,
  );

  // merge platform options with universal file replacements
  platformOptions.fileReplacements = [
    ...(platformOptions.fileReplacements || []),
    ...(options.fileReplacements || []),
  ];

  if (platformTarget === 'server') {
    const serverOptions = platformOptions as ServerBuilderOptions;

    if (typeof serverOptions.bundleDependencies === 'string') {
      serverOptions.bundleDependencies = (serverOptions.bundleDependencies === 'all') as any;
      // tslint:disable-next-line: max-line-length
      context.logger.warn(`Server option 'bundleDependencies' string value is deprecated since version 9. Use a boolean value instead.`);
    }
  }

  return platformOptions as UniversalTargetOptionsMap[K];
}

export async function validateTargetOptions<T>(
  context: BuilderContext,
  targetString: string,
  overrides?: Partial<T>,
): Promise<T> {
  const target = targetFromTargetString(targetString);
  const builderName = await context.getBuilderNameForTarget(target);
  const optionsRaw = await context.getTargetOptions(target);
  const options = await context.validateOptions<json.JsonObject & T>(
    { ...optionsRaw, ...overrides },
    builderName,
  );

  return options;
}

// #endregion options utils

// #region browser builder

export async function initializeBrowserBuilder(
  universalOptions: UniversalBuildOptions,
  browserOptions: BrowserBuilderOptions,
  context: BuilderContext,
  host: virtualFs.Host<fs.Stats>,
): Promise<BrowserBuilderInitContext> {
  const {
    config: browserConfig,
    projectRoot,
    projectSourceRoot,
    i18n,
  } = await buildBrowserWebpackConfigFromContext(
    browserOptions,
    // @hack: trick generateWebpackConfig to support differential loading
    // v9.0.0-rc.5/packages/angular_devkit/build_angular/src/utils/webpack-browser-config.ts#L74
    {
      ...context,
      builder: {
        ...context.builder,
        builderName: 'browser',
      },
    },
    host,
    true,
  );

  const config = await applyWebpackPartialConfig(
    browserConfig,
    universalOptions.partialBrowserConfig as string,
  );

  const tsConfig = readTsconfig(browserOptions.tsConfig, context.workspaceRoot);
  const target = tsConfig.options.target || ScriptTarget.ES5;
  const buildBrowserFeatures = new BuildBrowserFeatures(projectRoot, target);
  const isDifferentialLoadingNeeded = buildBrowserFeatures.isDifferentialLoadingNeeded();
  const useBundleDownleveling = isDifferentialLoadingNeeded && !browserOptions.watch;

  if (target > ScriptTarget.ES2015 && isDifferentialLoadingNeeded) {
    context.logger.warn(tags.stripIndent`
      WARNING: Using differential loading with targets ES5 and ES2016 or higher may
      cause problems. Browsers with support for ES2015 will load the ES2016+ scripts
      referenced with script[type="module"] but they may not support ES2016+ syntax.
    `);
  }

  if (browserOptions.deleteOutputPath) {
    deleteOutputDir(
      context.workspaceRoot,
      browserOptions.outputPath,
    );
  }

  return {
    options: browserOptions,
    config,
    projectRoot,
    projectSourceRoot,
    i18n,
    isDifferentialLoadingNeeded,
    target,
    useBundleDownleveling,
  };
}

// source: v9.0.0-rc.5/packages/angular_devkit/build_angular/src/browser/index.ts#L267
// tslint:disable-next-line: no-big-function
export function createBrowserBuilderFinalizer(
  context: BuilderContext,
  host: virtualFs.Host<fs.Stats>,
  {
    options,
    projectRoot,
    projectSourceRoot,
    i18n,
    isDifferentialLoadingNeeded,
    target,
    useBundleDownleveling,
  }: BrowserBuilderInitContext,
): (startTime: number, buildEvent: BuildResult) => Promise<BrowserBuilderOutput> {
  const root = normalize(context.workspaceRoot);
  const baseOutputPath = path.resolve(context.workspaceRoot, options.outputPath);

  // tslint:disable-next-line: no-big-function
  return async (startTime, buildEvent) => {
    const { webpackStats, success, emittedFiles = [] } = buildEvent;
    if (!webpackStats) {
      throw new Error('Webpack stats build result is required.');
    }

    let outputPaths: undefined | Map<string, string>;

    const finalize = (success: boolean, error?: string) => ({
      // ...event,
      success,
      error,
      baseOutputPath,
      outputPath: baseOutputPath,
      outputPaths: outputPaths && Array.from(outputPaths.values()) || [baseOutputPath],
    } as BrowserBuilderOutput);

    if (!success && useBundleDownleveling) {
      // If using bundle downleveling then there is only one build
      // If it fails show any diagnostic messages and bail
      if (webpackStats && webpackStats.warnings.length > 0) {
        context.logger.warn(statsWarningsToString(webpackStats, { colors: true }));
      }
      if (webpackStats && webpackStats.errors.length > 0) {
        context.logger.error(statsErrorsToString(webpackStats, { colors: true }));
      }

      return finalize(success);
    } else if (success) {
      outputPaths = ensureOutputPaths(baseOutputPath, i18n);

      let noModuleFiles: EmittedFiles[] | undefined;
      let moduleFiles: EmittedFiles[] | undefined;
      let files: EmittedFiles[] | undefined;

      const scriptsEntryPointName = normalizeExtraEntryPoints(
        options.scripts || [],
        'scripts',
      ).map(x => x.bundleName);

      if (isDifferentialLoadingNeeded && options.watch) {
        moduleFiles = emittedFiles;
        files = moduleFiles.filter(
          x => x.extension === '.css' || (x.name && scriptsEntryPointName.includes(x.name)),
        );
        if (i18n.shouldInline) {
          const success = await i18nInlineEmittedFiles(
            context,
            emittedFiles,
            i18n,
            baseOutputPath,
            Array.from(outputPaths.values()),
            scriptsEntryPointName,
            // tslint:disable-next-line: no-non-null-assertion
            webpackStats.outputPath!,
            target <= ScriptTarget.ES5,
            options.i18nMissingTranslation,
          );
          if (!success) {
            return finalize(false);
          }
        }
      } else if (isDifferentialLoadingNeeded) {
        moduleFiles = [];
        noModuleFiles = [];

        // Common options for all bundle process actions
        const sourceMapOptions = normalizeSourceMaps(options.sourceMap || false);
        const actionOptions: Partial<ProcessBundleOptions> = {
          optimize: normalizeOptimization(options.optimization).scripts,
          sourceMaps: sourceMapOptions.scripts,
          hiddenSourceMaps: sourceMapOptions.hidden,
          vendorSourceMaps: sourceMapOptions.vendor,
          integrityAlgorithm: options.subresourceIntegrity ? 'sha384' : undefined,
        };

        let mainChunkId;
        const actions: ProcessBundleOptions[] = [];
        let workerReplacements: [string, string][] | undefined;
        const seen = new Set<string>();
        for (const file of emittedFiles) {
          // Assets are not processed nor injected into the index
          if (file.asset) {
            // WorkerPlugin adds worker files to assets
            if (file.file.endsWith('.worker.js')) {
              if (!workerReplacements) {
                workerReplacements = [];
              }
              workerReplacements.push([
                file.file,
                file.file.replace(/\-es20\d{2}/, '-es5'),
              ]);
            } else {
              continue;
            }
          }

          // Scripts and non-javascript files are not processed
          if (
            file.extension !== '.js' ||
            (file.name && scriptsEntryPointName.includes(file.name))
          ) {
            if (files === undefined) {
              files = [];
            }
            files.push(file);
            continue;
          }

          // Ignore already processed files; emittedFiles can contain duplicates
          if (seen.has(file.file)) {
            continue;
          }
          seen.add(file.file);

          if (file.name === 'vendor' || (!mainChunkId && file.name === 'main')) {
            // tslint:disable-next-line: no-non-null-assertion
            mainChunkId = file.id!.toString();
          }

          // All files at this point except ES5 polyfills are module scripts
          const es5Polyfills =
            file.file.startsWith('polyfills-es5') ||
            file.file.startsWith('polyfills-nomodule-es5');
          if (!es5Polyfills) {
            moduleFiles.push(file);
          }
          // If not optimizing then ES2015 polyfills do not need processing
          // Unlike other module scripts, it is never downleveled
          const es2015Polyfills = file.file.startsWith('polyfills-es20');
          if (!actionOptions.optimize && es2015Polyfills) {
            continue;
          }

          // Retrieve the content/map for the file
          // NOTE: Additional future optimizations will read directly from memory
          // tslint:disable-next-line: no-non-null-assertion
          let filename = path.join(webpackStats.outputPath!, file.file);
          const code = fs.readFileSync(filename, 'utf8');
          let map;
          if (actionOptions.sourceMaps) {
            try {
              map = fs.readFileSync(filename + '.map', 'utf8');
              if (es5Polyfills) {
                fs.unlinkSync(filename + '.map');
              }
            } catch {}
          }

          if (es5Polyfills) {
            fs.unlinkSync(filename);
            filename = filename.replace(/\-es20\d{2}/, '');
          }

          // Record the bundle processing action
          // The runtime chunk gets special processing for lazy loaded files
          actions.push({
            ...actionOptions,
            filename,
            code,
            map,
            // id is always present for non-assets
            // tslint:disable-next-line: no-non-null-assertion
            name: file.id!,
            runtime: file.file.startsWith('runtime'),
            ignoreOriginal: es5Polyfills,
            optimizeOnly: es2015Polyfills,
          });

          // ES2015 polyfills are only optimized; optimization check was performed above
          if (es2015Polyfills) {
            continue;
          }

          // Add the newly created ES5 bundles to the index as nomodule scripts
          const newFilename = es5Polyfills
            ? file.file.replace(/\-es20\d{2}/, '')
            : file.file.replace(/\-es20\d{2}/, '-es5');
          noModuleFiles.push({ ...file, file: newFilename });
        }

        const processActions: typeof actions = [];
        let processRuntimeAction: ProcessBundleOptions | undefined;
        const processResults: ProcessBundleResult[] = [];
        for (const action of actions) {
          // If SRI is enabled always process the runtime bundle
          // Lazy route integrity values are stored in the runtime bundle
          if (action.integrityAlgorithm && action.runtime) {
            processRuntimeAction = action;
          } else {
            processActions.push({ replacements: workerReplacements, ...action });
          }
        }

        const executor = new BundleActionExecutor(
          { cachePath: cacheDownlevelPath, i18n },
          options.subresourceIntegrity ? 'sha384' : undefined,
        );

        // Execute the bundle processing actions
        try {
          context.logger.info('Generating ES5 bundles for differential loading...');

          for await (const result of executor.processAll(processActions)) {
            processResults.push(result);
          }

          // Runtime must be processed after all other files
          if (processRuntimeAction) {
            const runtimeOptions = {
              ...processRuntimeAction,
              runtimeData: processResults,
            };
            processResults.push(
              await import('@angular-devkit/build-angular/src/utils/process-bundle')
                .then(m => m.process(runtimeOptions)),
            );
          }

          context.logger.info('ES5 bundle generation complete.');

          if (i18n.shouldInline) {
            context.logger.info('Generating localized bundles...');

            const inlineActions: InlineOptions[] = [];
            const processedFiles = new Set<string>();
            for (const result of processResults) {
              if (result.original) {
                inlineActions.push({
                  filename: path.basename(result.original.filename),
                  code: fs.readFileSync(result.original.filename, 'utf8'),
                  map:
                    result.original.map &&
                    fs.readFileSync(result.original.map.filename, 'utf8'),
                  outputPath: baseOutputPath,
                  es5: false,
                  missingTranslation: options.i18nMissingTranslation,
                  setLocale: result.name === mainChunkId,
                });
                processedFiles.add(result.original.filename);
              }
              if (result.downlevel) {
                inlineActions.push({
                  filename: path.basename(result.downlevel.filename),
                  code: fs.readFileSync(result.downlevel.filename, 'utf8'),
                  map:
                    result.downlevel.map &&
                    fs.readFileSync(result.downlevel.map.filename, 'utf8'),
                  outputPath: baseOutputPath,
                  es5: true,
                  missingTranslation: options.i18nMissingTranslation,
                  setLocale: result.name === mainChunkId,
                });
                processedFiles.add(result.downlevel.filename);
              }
            }

            let hasErrors = false;
            try {
              for await (const result of executor.inlineAll(inlineActions)) {
                if (options.verbose) {
                  context.logger.info(
                    `Localized "${result.file}" [${result.count} translation(s)].`,
                  );
                }
                for (const diagnostic of result.diagnostics) {
                  if (diagnostic.type === 'error') {
                    hasErrors = true;
                    context.logger.error(diagnostic.message);
                  } else {
                    context.logger.warn(diagnostic.message);
                  }
                }
              }

              // Copy any non-processed files into the output locations
              await copyAssets(
                [
                  {
                    glob: '**/*',
                    // tslint:disable-next-line: no-non-null-assertion
                    input: webpackStats.outputPath!,
                    output: '',
                    ignore: [...processedFiles].map(f =>
                      // tslint:disable-next-line: no-non-null-assertion
                      path.relative(webpackStats.outputPath!, f),
                    ),
                  },
                ],
                Array.from(outputPaths.values()),
                '',
              );
            } catch (err) {
              context.logger.error('Localized bundle generation failed: ' + err.message);

              return finalize(false);
            }

            context.logger.info(
              `Localized bundle generation ${hasErrors ? 'failed' : 'complete'}.`,
            );

            if (hasErrors) {
              return finalize(false);
            }
          }
        } finally {
          executor.stop();
        }

        // Copy assets
        if (options.assets) {
          try {
            await copyAssets(
              normalizeAssetPatterns(
                options.assets,
                new virtualFs.SyncDelegateHost(host),
                root,
                normalize(projectRoot),
                projectSourceRoot === undefined ? undefined : normalize(projectSourceRoot),
              ),
              Array.from(outputPaths.values()),
              context.workspaceRoot,
            );
          } catch (err) {
            context.logger.error('Unable to copy assets: ' + err.message);

            return finalize(false);
          }
        }

        type ArrayElement<A> = A extends ReadonlyArray<infer T> ? T : never;
        function generateBundleInfoStats(
          id: string | number,
          bundle: ProcessBundleFile,
          chunk: ArrayElement<webpack.Stats.ToJsonOutput['chunks']> | undefined,
        ): string {
          return generateBundleStats(
            {
              id,
              size: bundle.size,
              files: bundle.map ? [bundle.filename, bundle.map.filename] : [bundle.filename],
              names: chunk && chunk.names,
              entry: !!chunk && chunk.names.includes('runtime'),
              initial: !!chunk && chunk.initial,
              rendered: true,
            },
            true,
          );
        }

        let bundleInfoText = '';
        const processedNames = new Set<string>();
        for (const result of processResults) {
          processedNames.add(result.name);

          const chunk =
            webpackStats &&
            webpackStats.chunks &&
            webpackStats.chunks.find(c => result.name === c.id.toString());
          if (result.original) {
            bundleInfoText +=
              '\n' + generateBundleInfoStats(result.name, result.original, chunk);
          }
          if (result.downlevel) {
            bundleInfoText +=
              '\n' + generateBundleInfoStats(result.name, result.downlevel, chunk);
          }
        }

        if (webpackStats && webpackStats.chunks) {
          for (const chunk of webpackStats.chunks) {
            if (processedNames.has(chunk.id.toString())) {
              continue;
            }

            const asset =
              webpackStats.assets && webpackStats.assets.find(a => a.name === chunk.files[0]);
            bundleInfoText +=
              '\n' + generateBundleStats({ ...chunk, size: asset && asset.size }, true);
          }
        }

        bundleInfoText +=
          '\n' +
          generateBuildStats(
            (webpackStats && webpackStats.hash) || '<unknown>',
            Date.now() - startTime,
            true,
          );
        context.logger.info(bundleInfoText);
        if (webpackStats && webpackStats.warnings.length > 0) {
          context.logger.warn(statsWarningsToString(webpackStats, { colors: true }));
        }
        if (webpackStats && webpackStats.errors.length > 0) {
          context.logger.error(statsErrorsToString(webpackStats, { colors: true }));
        }
      } else {
        files = emittedFiles.filter(x => x.name !== 'polyfills-es5');
        noModuleFiles = emittedFiles.filter(x => x.name === 'polyfills-es5');
        if (i18n.shouldInline) {
          const success = await i18nInlineEmittedFiles(
            context,
            emittedFiles,
            i18n,
            baseOutputPath,
            Array.from(outputPaths.values()),
            scriptsEntryPointName,
            // tslint:disable-next-line: no-non-null-assertion
            webpackStats.outputPath!,
            target <= ScriptTarget.ES5,
            options.i18nMissingTranslation,
          );
          if (!success) {
            return finalize(false);
          }
        }
      }

      if (options.index) {
        for (const [locale, outputPath] of outputPaths.entries()) {
          let localeBaseHref;
          if (i18n.locales[locale] && i18n.locales[locale].baseHref !== '') {
            localeBaseHref = path.posix.join(
              options.baseHref || '',
              i18n.locales[locale].baseHref === undefined
                ? `/${locale}/`
                : i18n.locales[locale].baseHref as string,
            );
          }

          try {
            await generateIndex(
              outputPath,
              options,
              root,
              files,
              noModuleFiles,
              moduleFiles,
              // transforms.indexHtml,
              undefined,
              // i18nLocale is used when Ivy is disabled
              locale || options.i18nLocale,
              localeBaseHref || options.baseHref,
            );
          } catch (err) {
            return finalize(false, mapErrorToMessage(err));
          }
        }
      }

      if (!options.watch && options.serviceWorker) {
        for (const outputPath of outputPaths.values()) {
          try {
            await augmentAppWithServiceWorker(
              host,
              root,
              normalize(projectRoot),
              normalize(outputPath),
              options.baseHref || '/',
              options.ngswConfigPath,
            );
          } catch (err) {
            return finalize(false, mapErrorToMessage(err));
          }
        }
      }
    }

    return finalize(success);
  };
}

// source: master/packages/angular_devkit/build_angular/src/browser/index.ts#L739
function generateIndex(
  baseOutputPath: string,
  options: BrowserBuilderOptions,
  root: string,
  files: EmittedFiles[] | undefined,
  noModuleFiles: EmittedFiles[] | undefined,
  moduleFiles: EmittedFiles[] | undefined,
  transformer?: IndexHtmlTransform,
  locale?: string,
  baseHref?: string,
): Promise<void> {
  const host = new NodeJsSyncHost();

  return writeIndexHtml({
    host,
    outputPath: join(normalize(baseOutputPath), getIndexOutputFile(options)),
    indexPath: join(normalize(root), getIndexInputFile(options)),
    files,
    noModuleFiles,
    moduleFiles,
    baseHref,
    deployUrl: options.deployUrl,
    sri: options.subresourceIntegrity,
    scripts: options.scripts,
    styles: options.styles,
    postTransform: transformer,
    crossOrigin: options.crossOrigin,
    lang: locale,
  }).toPromise();
}

// source: master/packages/angular_devkit/build_angular/src/browser/index.ts#L770
function mapErrorToMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return undefined;
}

// #endregion browser builder

// #region server builder

export async function initializeServerBuilder(
  universalOptions: UniversalBuildOptions,
  browserOptions: BrowserBuilderOptions,
  serverOptions: ServerBuilderOptions,
  context: BuilderContext,
): Promise<ServerBuilderInitContext> {
  const {
    config: serverConfig,
    projectRoot,
    projectSourceRoot,
    i18n,
  } = await generateI18nBrowserWebpackConfigFromContext(
    {
      ...serverOptions,
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
      getAotConfig(wco),
    ],
  );

  setWebpackServerFileLoaderEmitFile(universalOptions, serverOptions, browserOptions, serverConfig);
  setWebpackServerExternals(universalOptions, serverConfig);

  const config = await applyWebpackPartialConfig(
    serverConfig,
    universalOptions.partialServerConfig as string,
  );

  const tsConfig = readTsconfig(serverOptions.tsConfig, context.workspaceRoot);
  const target = tsConfig.options.target || ScriptTarget.ES5;

  if (serverOptions.deleteOutputPath) {
    deleteOutputDir(
      context.workspaceRoot,
      serverOptions.outputPath,
    );
  }

  return {
    options: serverOptions,
    config,
    projectRoot,
    projectSourceRoot,
    i18n,
    target,
  };
}

export function createServerBuilderFinalizer(
  context: BuilderContext,
  {
    options,
    i18n,
    target,
  }: ServerBuilderInitContext,
): (output: BuildResult) => Promise<ServerBuilderOutput> {
  const baseOutputPath = path.resolve(context.workspaceRoot, options.outputPath);

  return async output => {
    const { emittedFiles = [], webpackStats } = output;
    if (!output.success || !i18n.shouldInline) {
      return output as ServerBuilderOutput;
    }

    if (!webpackStats) {
      throw new Error('Webpack stats build result is required.');
    }

    const outputPaths = ensureOutputPaths(baseOutputPath, i18n);

    /*const success = */
    await i18nInlineEmittedFiles(
      context,
      emittedFiles,
      i18n,
      baseOutputPath,
      Array.from(outputPaths.values()),
      [],
      // tslint:disable-next-line: no-non-null-assertion
      webpackStats.outputPath!,
      target <= ScriptTarget.ES5,
      options.i18nMissingTranslation,
    );

    if (!output.success) {
      return output as ServerBuilderOutput;
    }

    return {
      ...output,
      baseOutputPath,
      outputPath: baseOutputPath,
      outputPaths: outputPaths ? outputPaths.values() : [baseOutputPath],
    } as ServerBuilderOutput;
  };
}

export function setWebpackServerExternals(
  universalOptions: UniversalBuildOptions,
  serverConfig: webpack.Configuration,
): void {
  const externals = serverConfig.externals as webpack.ExternalsElement[];
  const lastExternalIndex = externals.length - 1;

  // note(enten): angular server model declare an array with a function filter as last item
  // when server option `bundleDependencies` is false.
  //
  // When function filter is missing, that means server option `bundleDependencies` is true.
  // In this case, universal option `bundleDependenciesWhitelist` can be ignored because
  // we want to bundle all dependencies except server option `externalDependencies` (which
  // are already set into webpack server config `externals`).
  //
  // tslint:disable-next-line: max-line-length
  // @see v9.0.0-rc.5/packages/angular_devkit/build_angular/src/angular-cli-files/models/webpack-configs/server.ts#L42
  // tslint:disable-next-line: max-line-length
  // @see v9.0.0-rc.6/packages/angular_devkit/build_angular/src/angular-cli-files/models/webpack-configs/server.ts#L49
  if (!externals || typeof externals[lastExternalIndex] !== 'function') {
    return;
  }

  const angularServerExternalsFn = externals.pop() as webpack.ExternalsFunctionElement;

  const whitelistStrings = [...(universalOptions.bundleDependenciesWhitelist || [])];

  if (!whitelistStrings.includes('^@angular/')) {
    whitelistStrings.push('^@angular/');
  }

  if (!whitelistStrings.includes('^@nguniversal/')) {
    whitelistStrings.push('^@nguniversal/');
  }

  const whitelistPatterns = whitelistStrings.map(whitelistPattern => new RegExp(whitelistPattern))
  const isWhitelisted: (request: string) => boolean = request => {
    for (const whitelistPattern of whitelistPatterns) {
      if (whitelistPattern.test(request)) {
        return true;
      }
    }

    return false;
  };

  externals[lastExternalIndex] = (
    context: string,
    request: string,
    callback: (error?: null, result?: string) => void,
  ) => {
    if (isWhitelisted(request)) {
      callback();
    } else {
      angularServerExternalsFn(context, request, callback);
    }
  };
}

export function setWebpackServerFileLoaderEmitFile(
  universalOptions: UniversalBuildOptions,
  serverOptions: ServerBuilderOptions,
  browserOptions: BrowserBuilderOptions,
  webpackConfig: webpack.Configuration,
): void {
  const emitFile = !!universalOptions.fileLoaderEmitFile;
  const fileLoader = webpackConfig.module
    && webpackConfig.module.rules
    && webpackConfig.module.rules.find(rule => rule.loader === 'file-loader');

  if (fileLoader) {
    if (fileLoader.options) {
      (fileLoader.options as { emitFile: boolean }).emitFile = emitFile;
    } else {
      fileLoader.options = { emitFile: emitFile };
    }
  }

  if (emitFile || !webpackConfig.module) {
    return;
  }

  // fix: avoid extract css files when value is false

  // Determine hashing format.
  const hashFormat = getOutputHashFormat(serverOptions.outputHashing as string);

  const autoprefixer = require('autoprefixer');
  const postcssImports = require('postcss-import');

  const udkPostcssPluginCreator = (loader: webpack.loader.LoaderContext) => [
    postcssImports({
      resolve: (url: string) => (url.startsWith('~') ? url.substr(1) : url),
      load: (filename: string) => {
        return new Promise<string>((resolve, reject) => {
          loader.fs.readFile(filename, (err: Error, data: Buffer) => {
            if (err) {
              reject(err);

              return;
            }

            const content = data.toString();
            resolve(content);
          });
        });
      },
    }),
    PostcssCliResources({
      baseHref: browserOptions.baseHref,
      deployUrl: browserOptions.deployUrl,
      resourcesOutputPath: browserOptions.resourcesOutputPath,
      loader,
      rebaseRootRelative: browserOptions.rebaseRootRelativeCssUrls,
      filename: `[name]${hashFormat.file}.[ext]`,
    }),
    autoprefixer(),
  ];

  for (const rule of webpackConfig.module.rules) {
    if (!rule || !rule.test || !(rule.test instanceof RegExp) || !rule.use) {
      continue;
    }

    if (!rule.test.test('.scss') && !rule.test.test('.less') && !rule.test.test('.styl')) {
      continue;
    }

    // tslint:disable-next-line: max-line-length
    const postcssLoader = (rule.use as webpack.RuleSetLoader[]).find((ruleUse: webpack.RuleSetLoader) => {
      return !!ruleUse.loader && ruleUse.loader.indexOf('postcss-loader') !== -1;
    });

    if (!postcssLoader) {
        continue;
    }

    // tslint:disable-next-line: no-any
    (postcssLoader.options as { [k: string]: any }).plugins = udkPostcssPluginCreator;
  }
}

// #endregion server builder

// #region webpack compiler utils

export function createUniversalWebpackConfig(
  browserConfig: webpack.Configuration,
  serverConfig: webpack.Configuration,
): webpack.Configuration[] {
  browserConfig = { name: 'browser', ...browserConfig };
  serverConfig = { name: 'server', ...serverConfig };

  const dependencies: string[] = 'dependencies' in serverConfig
    && serverConfig['dependencies']
    || [];

  if (!dependencies.includes(browserConfig.name as string)) {
    dependencies.push(browserConfig.name as string);
  }

  return [
    browserConfig,
    { ...serverConfig, dependencies } as webpack.Configuration,
  ];
}

export function createUniversalCompilationOutput(
  multiStats: webpack.compilation.MultiStats & { hasErrors: () => boolean; },
) {
  const [ browserStats, serverStats ] = multiStats.stats;

  const success = !multiStats.hasErrors();
  const browserSuccess = !browserStats.hasErrors();
  const serverSuccess = !serverStats.hasErrors();

  return {
    success,
    hash: multiStats.hash,
    browserSuccess,
    browserStats,
    browserEmittedFiles: getEmittedFiles(browserStats.compilation),
    serverSuccess,
    serverStats,
    serverEmittedFiles: getEmittedFiles(serverStats.compilation),
  } as UniversalCompilationOutput;
}

export async function createWebpackMultiCompiler(
  getWebpackModule: () => Promise<typeof webpack>,
  multiConfig: webpack.Configuration[],
): Promise<webpack.MultiCompiler> {
  const webpackModule = await getWebpackModule();
  const multiCompiler = webpackModule(multiConfig as webpack.Configuration);

  return multiCompiler as {} as webpack.MultiCompiler;
}

export function runUniversalWebpackCompiler(
  multiCompiler: webpack.MultiCompiler,
  logger: logging.LoggerApi,
): Observable<UniversalCompilationOutput> {
  const [ browserConfig ] = multiCompiler.compilers.map(compiler => compiler.options);

  return new Observable<UniversalCompilationOutput>(obs => {
    const callback = ((
      // tslint:disable-next-line: no-any
      err: any,
      multiStats: webpack.compilation.MultiStats & { hasErrors: () => boolean; },
    ) => {
      if (err) {
        return obs.error(err);
      }

      obs.next(createUniversalCompilationOutput(multiStats));

      if (!browserConfig.watch) {
        obs.complete();
      }
    }) as unknown as webpack.MultiCompiler.Handler;

    let teardown: TeardownLogic = () => {};

    try {
      if (browserConfig.watch) {
        const watchOptions = browserConfig.watchOptions || {};
        const watching = multiCompiler.watch(watchOptions, callback);

        // Teardown logic. Close the watcher when unsubscribed from.
        teardown = () => watching.close(() => { });
      } else {
        multiCompiler.run(callback);
      }
    } catch (err) {
      if (err) {
        logger.error(`\nAn error occurred during the build:\n${err && err.stack || err}`);
      }

      throw err;
    }

    return teardown;
  });
}

export function adaptWebpackLoggingCallback(logFn: WebpackLoggingCallback) {
  return (
    multiStats: webpack.Stats | webpack.compilation.MultiStats,
    multiConfig: webpack.Configuration | webpack.Configuration[],
  ) => {
    if (!multiStats) {
      return;
    }

    if (!('stats' in multiStats)) {
      multiStats = { stats: [ multiStats ] } as webpack.compilation.MultiStats;
    }

    if (!multiConfig) {
      multiConfig = (multiStats as webpack.compilation.MultiStats).stats.map(stats => {
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

export async function applyWebpackPartialConfig(
  config: webpack.Configuration,
  partialTransformConfigPath: string,
) {
  if (!partialTransformConfigPath) {
    return config;
  }

  const configTransformer = requireModule<ExecutionTransformer<webpack.Configuration>>(
    partialTransformConfigPath,
  );

  if (typeof configTransformer !== 'function') {
    // tslint:disable-next-line: max-line-length
    throw new Error(`Partial webpack config transformer ${partialTransformConfigPath} invalid: must return a function`);
  }

  const transformedConfig = await configTransformer(config);

  return transformedConfig || config;
}

// #endregion webpack compiler utils
