// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:max-line-length no-any no-global-tslint-disable no-implicit-dependencies

import * as fs from 'fs';
import * as path from 'path';

import { Observable, TeardownLogic } from 'rxjs';
import * as textTable from 'text-table';
import { ScriptTarget } from 'typescript';
import webpack = require('webpack');

import { BuilderContext, Target, targetFromTargetString, targetStringFromTarget } from '@angular-devkit/architect';
import { BuildResult, EmittedFiles, WebpackLoggingCallback } from '@angular-devkit/build-webpack';
import { getSystemPath, join, json, logging, normalize, relative, resolve, tags, virtualFs } from '@angular-devkit/core';

// #region build-angular imports

import { BrowserBuilderOutput, getAnalyticsConfig, getCompilerConfig } from '@angular-devkit/build-angular/src/browser';
import { ServerBuilderOutput } from '@angular-devkit/build-angular/src/server';
import { ExecutionTransformer } from '@angular-devkit/build-angular/src/transforms';
import { BundleActionExecutor } from '@angular-devkit/build-angular/src/utils/action-executor';
import { BuildBrowserFeatures } from '@angular-devkit/build-angular/src/utils/build-browser-features';
import { ThresholdSeverity, checkBudgets } from '@angular-devkit/build-angular/src/utils/bundle-calculator';
import { findCachePath } from '@angular-devkit/build-angular/src/utils/cache-path';
import { colors as ansiColors, removeColor } from '@angular-devkit/build-angular/src/utils/color';
import { copyAssets } from '@angular-devkit/build-angular/src/utils/copy-assets';
import { deleteOutputDir } from '@angular-devkit/build-angular/src/utils/delete-output-dir';
import { cachingDisabled } from '@angular-devkit/build-angular/src/utils/environment-options';
import { mkdir, writeFile } from '@angular-devkit/build-angular/src/utils/fs';
import { i18nInlineEmittedFiles } from '@angular-devkit/build-angular/src/utils/i18n-inlining';
import { I18nOptions } from '@angular-devkit/build-angular/src/utils/i18n-options';
import { FileInfo } from '@angular-devkit/build-angular/src/utils/index-file/augment-index-html';
import { IndexHtmlGenerator, IndexHtmlTransform } from '@angular-devkit/build-angular/src/utils/index-file/index-html-generator';
import { normalizeAssetPatterns } from '@angular-devkit/build-angular/src/utils/normalize-asset-patterns';
import { NormalizedBrowserBuilderSchema } from '@angular-devkit/build-angular/src/utils/normalize-builder-schema';
import { normalizeOptimization } from '@angular-devkit/build-angular/src/utils/normalize-optimization';
import { normalizeSourceMaps } from '@angular-devkit/build-angular/src/utils/normalize-source-maps';
import { ensureOutputPaths } from '@angular-devkit/build-angular/src/utils/output-paths';
import { generateEntryPoints } from '@angular-devkit/build-angular/src/utils/package-chunk-sort';
import {
  InlineOptions,
  ProcessBundleFile,
  ProcessBundleOptions,
  ProcessBundleResult,
} from '@angular-devkit/build-angular/src/utils/process-bundle';
import { readTsconfig } from '@angular-devkit/build-angular/src/utils/read-tsconfig';
import { augmentAppWithServiceWorker } from '@angular-devkit/build-angular/src/utils/service-worker';
import { Spinner } from '@angular-devkit/build-angular/src/utils/spinner';
import { urlJoin } from '@angular-devkit/build-angular/src/utils/url';
import {
  generateI18nBrowserWebpackConfigFromContext,
  getIndexInputFile,
  getIndexOutputFile,
} from '@angular-devkit/build-angular/src/utils/webpack-browser-config';
import { normalizeExtraEntryPoints } from '@angular-devkit/build-angular/src/webpack/utils/helpers';
import {
  getAotConfig,
  getBrowserConfig,
  getCommonConfig,
  getServerConfig,
  getStatsConfig,
  getStylesConfig,
  getWorkerConfig,
} from '@angular-devkit/build-angular/src/webpack/configs';
import { markAsyncChunksNonInitial } from '@angular-devkit/build-angular/src/webpack/utils/async-chunks';
import {
  BundleStats,
  BundleStatsData,
  ChunkType,
  formatSize,
  generateBundleStats,
  statsErrorsToString,
  statsHasErrors,
  statsHasWarnings,
  statsWarningsToString,
} from '@angular-devkit/build-angular/src/webpack/utils/stats';
import { getEmittedFiles } from '@angular-devkit/build-webpack/src/utils';

// #endregion build-angular imports

// #region local imports

import { requireModule } from '../../../lib/util/requireModule';
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

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L79
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

  // warn when target output path is outside universal output path
  if (options.outputPath) {
    const universalOutputPath = path.resolve(context.workspaceRoot, options.outputPath);
    const platformOutputPath = path.resolve(context.workspaceRoot, platformOptions.outputPath);
    const platformOutputPathRelativeToUniversalOutputPath = path.relative(universalOutputPath, platformOutputPath);

    if (platformOutputPathRelativeToUniversalOutputPath.startsWith('..')) {
      // tslint:disable-next-line: max-line-length
      context.logger.warn(`Warning: Option 'outputPath' (${platformOptions.outputPath}) of target ${targetString} is outside option 'outputPath' (${options.outputPath}) of universal target ${targetStringFromTarget((context.target || {}) as Target)}`);
    }
  }

  // merge platform options with universal file replacements
  platformOptions.fileReplacements = [
    ...(platformOptions.fileReplacements || []),
    ...(options.fileReplacements || []),
  ];

  if (platformTarget === 'server') {
    const serverOptions = platformOptions as ServerBuilderOptions;

    if (typeof serverOptions.bundleDependencies === 'string') {
      // tslint:disable-next-line: no-any
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

// #region universal utils

export async function generatePackageJson(
  context: BuilderContext,
  universalOptions: UniversalBuildOptions,
  serverOptions: ServerBuilderOptions,
): Promise<void> {
  if (!context.target || !universalOptions.generatePackageJson || !universalOptions.outputPath) {
    return;
  }

  const serverOutputPathRelative = relative(
    resolve(normalize(context.workspaceRoot), normalize(universalOptions.outputPath)),
    resolve(normalize(context.workspaceRoot), normalize(serverOptions.outputPath)),
  );
  const mainPathRelative = join(serverOutputPathRelative, 'main.js');
  const workspacePackageJsonPath = path.resolve(context.workspaceRoot, 'package.json');
  let workspacePackageVersion = '0.0.0';

  try {
    const workspacePackageJson = require(workspacePackageJsonPath);

    if (workspacePackageJson?.version) {
      workspacePackageVersion = workspacePackageJson.version;
    }
  } catch (err) {
    context.logger.error('Error while reading workspace package.json:', err);
  }

  const projectMetadata = await context.getProjectMetadata(context.target);
  const projectPackageJsonPath = path.resolve(context.workspaceRoot, projectMetadata.root as string, 'package.json');
  let projectPackageJson: json.JsonObject = {};

  if (
    projectMetadata.root
    && projectPackageJsonPath !== workspacePackageJsonPath
    && fs.existsSync(projectPackageJsonPath)
  ) {
    projectPackageJson = require(projectPackageJsonPath);
  }

  const packageJson = {
    private: typeof projectPackageJson.private === 'boolean' ? projectPackageJson.private : true,
    name: context.target.project,
    version: '0.0.0',
    main: mainPathRelative,
    ...projectPackageJson,
  };

  packageJson.version = projectPackageJson.version && projectPackageJson.version !== '0.0.0'
    ? projectPackageJson.version as string
    : workspacePackageVersion;

  fs.writeFileSync(
    path.resolve(context.workspaceRoot, universalOptions.outputPath, 'package.json'),
    JSON.stringify(packageJson, null, 2),
    'utf8',
  );

  context.logger.info('Generating package.json complete.');
}

// #endregion

// #region browser builder

export async function initializeBrowserBuilder(
  universalOptions: UniversalBuildOptions,
  browserOptions: BrowserBuilderOptions,
  context: BuilderContext,
  host: virtualFs.Host<fs.Stats>,
): Promise<BrowserBuilderInitContext> {
  // https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L200

  const projectName = context.target?.project;
  if (!projectName) {
    throw new Error('The builder requires a target.');
  }

  const projectMetadata = await context.getProjectMetadata(projectName);

  const sysProjectRoot = getSystemPath(
    resolve(normalize(context.workspaceRoot),
    normalize((projectMetadata.root as string) ?? '')),
  );

  const { options: compilerOptions } = readTsconfig(browserOptions.tsConfig, context.workspaceRoot);
  const target = compilerOptions.target || ScriptTarget.ES5;
  const buildBrowserFeatures = new BuildBrowserFeatures(sysProjectRoot);
  const isDifferentialLoadingNeeded = buildBrowserFeatures.isDifferentialLoadingNeeded(target);

  if (target > ScriptTarget.ES2015 && isDifferentialLoadingNeeded) {
    context.logger.warn(tags.stripIndent`
    Warning: Using differential loading with targets ES5 and ES2016 or higher may
    cause problems. Browsers with support for ES2015 will load the ES2016+ scripts
    referenced with script[type="module"] but they may not support ES2016+ syntax.
  `);
  }

  const hasIE9 = buildBrowserFeatures.supportedBrowsers.includes('ie 9');
  const hasIE10 = buildBrowserFeatures.supportedBrowsers.includes('ie 10');
  if (hasIE9 || hasIE10) {
    const browsers =
      (hasIE9 ? 'IE 9' + (hasIE10 ? ' & ' : '') : '') + (hasIE10 ? 'IE 10' : '');
    context.logger.warn(
      `Warning: Support was requested for ${browsers} in the project's browserslist configuration. ` +
      (hasIE9 && hasIE10 ? 'These browsers are' : 'This browser is') +
      ' no longer officially supported with Angular v11 and higher.' +
      '\nFor additional information: https://v10.angular.io/guide/deprecations#ie-9-10-and-mobile',
    );
  }

  // https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L137

  const originalOutputPath = browserOptions.outputPath;

  // Assets are processed directly by the builder except when watching
  const adjustedOptions = browserOptions.watch ? browserOptions : { ...browserOptions, assets: [] };

  const {
    config: browserConfig,
    projectRoot,
    projectSourceRoot,
    i18n,
  } = await generateI18nBrowserWebpackConfigFromContext(
    adjustedOptions,
    context,
    wco => [
      getCommonConfig(wco),
      getBrowserConfig(wco),
      getStylesConfig(wco),
      getStatsConfig(wco),
      getAnalyticsConfig(wco, context),
      getCompilerConfig(wco),
      wco.buildOptions.webWorkerTsConfig ? getWorkerConfig(wco) : {},
    ],
    { differentialLoadingNeeded: isDifferentialLoadingNeeded },
  );

  // Validate asset option values if processed directly
  if (browserOptions.assets?.length && !adjustedOptions.assets?.length) {
    normalizeAssetPatterns(
      browserOptions.assets,
      normalize(context.workspaceRoot),
      normalize(projectRoot),
      projectSourceRoot === undefined ? undefined : normalize(projectSourceRoot),
    ).forEach(({ output }) => {
      if (output.startsWith('..')) {
        throw new Error('An asset cannot be written to a location outside of the output path.');
      }
    });
  }

  const config = await applyWebpackPartialConfig(
    browserConfig,
    universalOptions.partialBrowserConfig as string,
  );

  if (browserOptions.deleteOutputPath) {
    deleteOutputDir(context.workspaceRoot, originalOutputPath);
  }

  return {
    options: browserOptions,
    config,
    projectRoot,
    projectSourceRoot,
    i18n,
    isDifferentialLoadingNeeded,
    target,
    buildBrowserFeatures,
  };
}

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L267
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
    buildBrowserFeatures,
  }: BrowserBuilderInitContext,
  transforms: {
    webpackConfiguration?: ExecutionTransformer<webpack.Configuration>;
    logging?: WebpackLoggingCallback;
    indexHtml?: IndexHtmlTransform;
  } = {},
): (startTime: number, buildEvent: BuildResult) => Promise<BrowserBuilderOutput> {
  const root = normalize(context.workspaceRoot);
  const baseOutputPath = path.resolve(context.workspaceRoot, options.outputPath);

  const normalizedOptimization = normalizeOptimization(options.optimization);

  // tslint:disable-next-line: no-big-function
  return async (startTime, buildEvent) => {
    const spinner = new Spinner();
    spinner.enabled = options.progress !== false;

    const { webpackStats: webpackRawStats, success, emittedFiles = [] } = buildEvent;
    if (!webpackRawStats) {
      throw new Error('Webpack stats build result is required.');
    }

    // Fix incorrectly set `initial` value on chunks.
    const extraEntryPoints = [
      ...normalizeExtraEntryPoints(options.styles || [], 'styles'),
      ...normalizeExtraEntryPoints(options.scripts || [], 'scripts'),
    ];

    const webpackStats = {
      ...webpackRawStats,
      chunks: markAsyncChunksNonInitial(webpackRawStats, extraEntryPoints),
    };

    let outputPaths: undefined | Map<string, string>;

    const finalize = (success: boolean, error?: string) => ({
      // ...event,
      success,
      error,
      baseOutputPath,
      outputPath: baseOutputPath,
      outputPaths: outputPaths && Array.from(outputPaths.values()) || [baseOutputPath],
    } as BrowserBuilderOutput);

    if (!success) {
      // If using bundle downleveling then there is only one build
      // If it fails show any diagnostic messages and bail
      if (statsHasWarnings(webpackStats)) {
        context.logger.warn(statsWarningsToString(webpackStats, { colors: true }));
      }
      if (statsHasErrors(webpackStats)) {
        context.logger.error(statsErrorsToString(webpackStats, { colors: true }));
      }

      return finalize(false);
    } else {
      const processResults: ProcessBundleResult[] = [];
      const bundleInfoStats: BundleStats[] = [];
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
        files = (moduleFiles || []).filter(
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
          optimize: normalizedOptimization.scripts,
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
                file.file.replace(/\-(es20\d{2}|esnext)/, '-es5'),
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
          const es5Polyfills = file.file.startsWith('polyfills-es5');
          if (!es5Polyfills) {
            moduleFiles.push(file);
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
            } catch { }
          }

          if (es5Polyfills) {
            fs.unlinkSync(filename);
            filename = filename.replace(/\-es20\d{2}/, '');
          }

          const es2015Polyfills = file.file.startsWith('polyfills-es20');

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
            : file.file.replace(/\-(es20\d{2}|esnext)/, '-es5');
          noModuleFiles.push({ ...file, file: newFilename });
        }

        const processActions: typeof actions = [];
        let processRuntimeAction: ProcessBundleOptions | undefined;
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
          spinner.start('Generating ES5 bundles for differential loading...');
          for await (const result of executor.processAll(processActions)) {
            processResults.push(result);
          }

          // Runtime must be processed after all other files
          if (processRuntimeAction) {
            const runtimeOptions = {
              ...processRuntimeAction,
              runtimeData: processResults,
              supportedBrowsers: buildBrowserFeatures.supportedBrowsers,
            };
            processResults.push(
              await import('@angular-devkit/build-angular/src/utils/process-bundle')
                .then(m => m.process(runtimeOptions)),
            );
          }

          spinner.succeed('ES5 bundle generation complete.');

          if (i18n.shouldInline) {
            spinner.start('Generating localized bundles...');
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
                if (result.original.map) {
                  processedFiles.add(result.original.map.filename);
                }
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
                if (result.downlevel.map) {
                  processedFiles.add(result.downlevel.map.filename);
                }
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
                  spinner.stop();
                  if (diagnostic.type === 'error') {
                    hasErrors = true;
                    context.logger.error(diagnostic.message);
                  } else {
                    context.logger.warn(diagnostic.message);
                  }
                  spinner.start();
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
              spinner.fail('Localized bundle generation failed.');

              return finalize(false, mapErrorToMessage(err));
            }

            if (hasErrors) {
              spinner.fail('Localized bundle generation failed.');
            } else {
              spinner.succeed('Localized bundle generation complete.');
            }

            if (hasErrors) {
              return finalize(false);
            }
          }
        } finally {
          executor.stop();
        }
        for (const result of processResults) {
          const chunk = webpackStats.chunks?.find((chunk) => chunk.id.toString() === result.name);

          if (result.original) {
            bundleInfoStats.push(generateBundleInfoStats(result.original, chunk, 'modern'));
          }

          if (result.downlevel) {
            bundleInfoStats.push(generateBundleInfoStats(result.downlevel, chunk, 'legacy'));
          }
        }

        const unprocessedChunks = webpackStats.chunks?.filter((chunk) => !processResults
          .find((result) => chunk.id.toString() === result.name),
        ) || [];
        for (const chunk of unprocessedChunks) {
          const asset = webpackStats.assets?.find(a => a.name === chunk.files[0]);
          bundleInfoStats.push(generateBundleStats({ ...chunk, size: asset?.size }));
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

      // Check for budget errors and display them to the user.
      const budgets = options.budgets;
      if (budgets?.length) {
        const budgetFailures = checkBudgets(budgets, webpackStats, processResults);
        for (const { severity, message } of budgetFailures) {
          switch (severity) {
            case ThresholdSeverity.Warning:
              webpackStats.warnings.push(message);
              break;
            case ThresholdSeverity.Error:
              webpackStats.errors.push(message);
              break;
            default:
              assertNever(severity);
          }
        }
      }

      const buildSuccess = success && !statsHasErrors(webpackStats);
      if (buildSuccess) {
        // Copy assets
        if (!options.watch && options.assets?.length) {
          spinner.start('Copying assets...');
          try {
            await copyAssets(
              normalizeAssetPatterns(
                options.assets,
                root,
                normalize(projectRoot),
                projectSourceRoot === undefined ? undefined : normalize(projectSourceRoot),
              ),
              Array.from(outputPaths.values()),
              context.workspaceRoot,
            );
            spinner.succeed('Copying assets complete.');
          } catch (err) {
            spinner.fail(ansiColors.redBright('Copying of assets failed.'));

            return finalize(false, 'Unable to copy assets: ' + err.message);
          }
        }

        if (options.index) {
          spinner.start('Generating index html...');

          const WOFFSupportNeeded = !buildBrowserFeatures.isFeatureSupported('woff2');
          const entrypoints = generateEntryPoints({
            scripts: options.scripts ?? [],
            styles: options.styles ?? [],
          });

          const indexHtmlGenerator = new IndexHtmlGenerator({
            indexPath: path.join(context.workspaceRoot, getIndexInputFile(options.index)),
            entrypoints,
            deployUrl: options.deployUrl,
            sri: options.subresourceIntegrity,
            WOFFSupportNeeded,
            optimization: normalizedOptimization,
            crossOrigin: options.crossOrigin,
            postTransform: transforms.indexHtml,
          });

          for (const [locale, outputPath] of outputPaths.entries()) {
            try {
              const { content, warnings, errors } = await indexHtmlGenerator.process({
                baseHref: getLocaleBaseHref(options, i18n, locale) || options.baseHref,
                // i18nLocale is used when Ivy is disabled
                lang: locale || options.i18nLocale,
                outputPath,
                files: mapEmittedFilesToFileInfo(files),
                noModuleFiles: mapEmittedFilesToFileInfo(noModuleFiles),
                moduleFiles: mapEmittedFilesToFileInfo(moduleFiles),
              });

              if (warnings.length || errors.length) {
                spinner.stop();
                warnings.forEach(m => context.logger.warn(m));
                errors.forEach(m => context.logger.error(m));
                spinner.start();
              }

              const indexOutput = path.join(outputPath, getIndexOutputFile(options.index));
              await mkdir(path.dirname(indexOutput), { recursive: true });
              await writeFile(indexOutput, content);
            } catch (error) {
              spinner.fail('Index html generation failed.');

              return finalize(false, mapErrorToMessage(error));
            }
          }

          spinner.succeed('Index html generation complete.');
        }

        if (options.serviceWorker) {
          spinner.start('Generating service worker...');
          for (const [locale, outputPath] of outputPaths.entries()) {
            try {
              await augmentAppWithServiceWorker(
                root,
                normalize(projectRoot),
                normalize(outputPath),
                getLocaleBaseHref(options, i18n, locale) || options.baseHref || '/',
                options.ngswConfigPath,
              );
            } catch (error) {
              spinner.fail('Service worker generation failed.');

              return finalize(false, mapErrorToMessage(error));
            }
          }

          spinner.succeed('Service worker generation complete.');
        }
      }

      return finalize(buildSuccess);
    }
  };
}

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L757
function getLocaleBaseHref(options: { baseHref?: string; }, i18n: I18nOptions, locale: string): string | undefined {
  if (i18n.locales[locale] && i18n.locales[locale]?.baseHref !== '') {
    return urlJoin(
      options.baseHref || '',
      i18n.locales[locale].baseHref ?? `/${locale}/`,
    );
  }

  return undefined;
}

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L804
function mapEmittedFilesToFileInfo(files: EmittedFiles[] = []): FileInfo[] {
  const filteredFiles: FileInfo[] = [];
  for (const { file, name, extension, initial } of files) {
    if (name && initial) {
      filteredFiles.push({ file, extension, name });
    }
  }

  return filteredFiles;
}

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L769
function mapErrorToMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return undefined;
}

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L781
function assertNever(input: never): never {
  throw new Error(`Unexpected call to assertNever() with input: ${JSON.stringify(input, null /* replacer */, 4 /* tabSize */)}`);
}

// tslint:disable-next-line: max-line-length
// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/browser/index.ts#L785
type ArrayElement<A> = A extends ReadonlyArray<infer T> ? T : never;
function generateBundleInfoStats(
  bundle: ProcessBundleFile,
  chunk: ArrayElement<webpack.Stats.ToJsonOutput['chunks']> | undefined,
  chunkType: ChunkType,
): BundleStats {
  return generateBundleStats(
    {
      size: bundle.size,
      files: bundle.map ? [bundle.filename, bundle.map.filename] : [bundle.filename],
      names: chunk?.names,
      entry: !!chunk?.names.includes('runtime'),
      initial: !!chunk?.initial,
      rendered: true,
      chunkType,
    },
  );
}

// #endregion browser builder

// #region server builder

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/server/index.ts#L46
export async function initializeServerBuilder(
  universalOptions: UniversalBuildOptions,
  browserOptions: BrowserBuilderOptions,
  serverOptions: ServerBuilderOptions,
  context: BuilderContext,
): Promise<ServerBuilderInitContext> {
  const root = context.workspaceRoot;

  const tsConfig = readTsconfig(serverOptions.tsConfig, root);
  const target = tsConfig.options.target || ScriptTarget.ES5;

  if (typeof serverOptions.bundleDependencies === 'string') {
    serverOptions.bundleDependencies = serverOptions.bundleDependencies === 'all';
    context.logger.warn(`Option 'bundleDependencies' string value is deprecated since version 9. Use a boolean value instead.`);
  }

  if (!serverOptions.bundleDependencies && tsConfig.options.enableIvy) {
    // tslint:disable-next-line: no-implicit-dependencies
    const { __processed_by_ivy_ngcc__, main = '' } = require('@angular/core/package.json');
    if (
      !__processed_by_ivy_ngcc__ ||
      !__processed_by_ivy_ngcc__.main ||
      (main as string).includes('__ivy_ngcc__')
    ) {
      context.logger.warn(tags.stripIndent`
      Warning: Turning off 'bundleDependencies' with Ivy may result in undefined behaviour
      unless 'node_modules' are transformed using the standalone Angular compatibility compiler (NGCC).
      See: https://angular.io/guide/ivy#ivy-and-universal-app-shell
    `);
    }
  }

  // https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/server/index.ts#L151

  const originalOutputPath = serverOptions.outputPath;
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

  const config = await applyWebpackPartialConfig(
    serverConfig,
    universalOptions.partialServerConfig as string,
  );

  if (serverOptions.deleteOutputPath) {
    deleteOutputDir(
      context.workspaceRoot,
      originalOutputPath,
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

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/server/index.ts#L94
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

    output.success = await i18nInlineEmittedFiles(
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
        + (options.colors ? ansiColors.bold(configName) : configName)
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
    /*
    // https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/webpack/utils/stats.ts#L347
    export function webpackStatsLogger(
      logger: logging.LoggerApi,
      json: Stats.ToJsonOutput,
      config: Configuration,
      bundleStats?: BundleStats[],
    ): void {
      logger.info(statsToString(json, config.stats, bundleStats));

      if (statsHasWarnings(json)) {
        logger.warn(statsWarningsToString(json, config.stats));
      }
      if (statsHasErrors(json)) {
        logger.error(statsErrorsToString(json, config.stats));
      }
    };
    */
  };

  return adaptWebpackLoggingCallback(logStats);
}

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/webpack/utils/stats.ts#L155
function generateBuildStats(hash: string, time: number, colors: boolean): string {
  const w = (x: string) => colors ? ansiColors.bold.white(x) : x;
  return `Build at: ${w(new Date().toISOString())} - Hash: ${w(hash)} - Time: ${w('' + time)}ms`;
}

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/webpack/utils/stats.ts#L160
function statsToString(json: any, statsConfig: any, bundleState?: BundleStats[]): string {
  const colors = statsConfig.colors;
  const rs = (x: string) => colors ? ansiColors.reset(x) : x;

  const changedChunksStats: BundleStats[] = bundleState ?? [];
  let unchangedChunkNumber = 0;
  if (!bundleState?.length) {
    for (const chunk of json.chunks) {
      if (!chunk.rendered) {
        continue;
      }

      const assets = json.assets.filter((asset: any) => chunk.files.includes(asset.name));
      const summedSize = assets.filter((asset: any) => !asset.name.endsWith(".map")).reduce((total: number, asset: any) => { return total + asset.size }, 0);
      changedChunksStats.push(generateBundleStats({ ...chunk, size: summedSize }));
    }
    unchangedChunkNumber = json.chunks.length - changedChunksStats.length;
  }

  // Sort chunks by size in descending order
  changedChunksStats.sort((a, b) => {
    if (a.stats[2] > b.stats[2]) {
      return -1;
    }

    if (a.stats[2] < b.stats[2]) {
      return 1;
    }

    return 0;
  });

  const statsTable = generateBuildStatsTable(changedChunksStats, colors, unchangedChunkNumber === 0);

  // In some cases we do things outside of webpack context 
  // Such us index generation, service worker augmentation etc...
  // This will correct the time and include these.
  const time = (Date.now() - json.builtAt) + json.time;

  if (unchangedChunkNumber > 0) {
    return '\n' + rs(tags.stripIndents`
      ${statsTable}
      ${unchangedChunkNumber} unchanged chunks
      ${generateBuildStats(json.hash, time, colors)}
      `);
  } else {
    return '\n' + rs(tags.stripIndents`
      ${statsTable}
      ${generateBuildStats(json.hash, time, colors)}
      `);
  }
}

// https://github.com/angular/angular-cli/blob/v11.2.7/packages/angular_devkit/build_angular/src/webpack/utils/stats.ts#L65
function generateBuildStatsTable(data: BundleStats[], colors: boolean, showTotalSize: boolean): string {
  const g = (x: string) => colors ? ansiColors.greenBright(x) : x;
  const c = (x: string) => colors ? ansiColors.cyanBright(x) : x;
  const bold = (x: string) => colors ? ansiColors.bold(x) : x;
  const dim = (x: string) => colors ? ansiColors.dim(x) : x;

  const changedEntryChunksStats: BundleStatsData[] = [];
  const changedLazyChunksStats: BundleStatsData[] = [];

  let initialModernTotalSize = 0;
  let initialLegacyTotalSize = 0;
  let modernFileSuffix: string | undefined;

  for (const { initial, stats, chunkType } of data) {
    const [files, names, size] = stats;

    const data: BundleStatsData = [
      g(files),
      names,
      c(typeof size === 'number' ? formatSize(size) : size),
    ];

    if (initial) {
      changedEntryChunksStats.push(data);

      if (typeof size === 'number') {
        switch (chunkType) {
          case 'modern':
            initialModernTotalSize += size;
            if (!modernFileSuffix) {
              const match = files.match(/-(es20\d{2}|esnext)/);
              modernFileSuffix = match?.[1].toString().toUpperCase();
            }
            break;
          case 'legacy':
            initialLegacyTotalSize += size;
            break;
          default:
            initialModernTotalSize += size;
            initialLegacyTotalSize += size;
            break;
        }
      }
    } else {
      changedLazyChunksStats.push(data);
    }
  }

  const bundleInfo: (string | number)[][] = [];

  // Entry chunks
  if (changedEntryChunksStats.length) {
    bundleInfo.push(
      ['Initial Chunk Files', 'Names', 'Size'].map(bold),
      ...changedEntryChunksStats,
    );

    if (showTotalSize) {
      bundleInfo.push([]);
      if (initialModernTotalSize === initialLegacyTotalSize) {
        bundleInfo.push([' ', 'Initial Total', formatSize(initialModernTotalSize)].map(bold));
      } else {
        bundleInfo.push(
          [' ', 'Initial ES5 Total', formatSize(initialLegacyTotalSize)].map(bold),
          [' ', `Initial ${modernFileSuffix} Total`, formatSize(initialModernTotalSize)].map(bold),
        );
      }
    }
  }

  // Seperator
  if (changedEntryChunksStats.length && changedLazyChunksStats.length) {
    bundleInfo.push([]);
  }

  // Lazy chunks
  if (changedLazyChunksStats.length) {
    bundleInfo.push(
      ['Lazy Chunk Files', 'Names', 'Size'].map(bold),
      ...changedLazyChunksStats,
    );
  }

  return textTable(bundleInfo, {
    hsep: dim(' | '),
    stringLength: s => removeColor(s).length,
    align: ['l', 'l', 'r'],
  });
}

// #endregion webpack compiler utils
