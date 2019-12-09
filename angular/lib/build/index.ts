// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { assertCompatibleAngularVersion } from '@angular-devkit/build-angular/src/utils/version';
import { BuildResult } from '@angular-devkit/build-webpack';
import { json } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

import {
  createBrowserBuilderFinalizer,
  createLoggingCallback,
  createServerBuilderFinalizer,
  createUniversalWebpackConfig,
  createWebpackMultiCompiler,
  getUniversalTargetOptions,
  initializeBrowserBuilder,
  initializeServerBuilder,
  runUniversalWebpackCompiler,
} from './ng-devkit';
import {
  UniversalBuildOptions,
  UniversalBuildOutput,
} from './types';

export * from './ng-devkit';
export * from './types';

export async function ngUniversalBuild(
  options: UniversalBuildOptions,
  context: BuilderContext,
): Promise<UniversalBuildOutput> {
  assertCompatibleAngularVersion(context.workspaceRoot, context.logger);

  const projectName = context.target && context.target.project;
  if (!projectName) {
    throw new Error('The builder requires a target.');
  }

  context.reportStatus(`Executing...`);

  const host = new NodeJsSyncHost();

  const browserOptions = await getUniversalTargetOptions(context, options, 'browser');
  const serverOptions = await getUniversalTargetOptions(context, options, 'server');

  const browserBuilderInitContext = await initializeBrowserBuilder(
    options,
    browserOptions,
    context,
    host,
  );
  const browserBuilderFinalizer = createBrowserBuilderFinalizer(
    context,
    host,
    browserBuilderInitContext,
  );

  const serverBuilderInitContext = await initializeServerBuilder(
    options,
    browserOptions,
    serverOptions,
    context,
  );
  const serverBuilderFinalizer = createServerBuilderFinalizer(context, serverBuilderInitContext);

  const universalCompiler = await createWebpackMultiCompiler(
    // tslint:disable-next-line: no-any
    () => import('../../../lib/index') as any,
    createUniversalWebpackConfig(
      browserBuilderInitContext.config,
      serverBuilderInitContext.config,
    ),
  );

  const webpackLogging = createLoggingCallback(context.logger, {
    verbose: options.verbose,
    colors: true,
  });

  const startTime = Date.now();
  const {
    success,
    hash,
    browserSuccess,
    browserStats,
    browserEmittedFiles,
    serverSuccess,
    serverStats,
    serverEmittedFiles,
  } = await runUniversalWebpackCompiler(
    universalCompiler,
    context.logger,
  ).toPromise();

  webpackLogging(browserStats, browserBuilderInitContext.config);
  webpackLogging(serverStats, serverBuilderInitContext.config);

  await browserBuilderFinalizer(startTime, {
    success: browserSuccess,
    webpackStats: browserStats.toJson(),
    emittedFiles: browserEmittedFiles,
  } as BuildResult);

  await serverBuilderFinalizer({
    success: serverSuccess,
    webpackStats: serverStats.toJson(),
    emittedFiles: serverEmittedFiles,
  } as BuildResult);

  context.reportStatus(`Done.`);

  return {
    success,
    hash,
    browserSuccess,
    browserEmittedFiles,
    browserOptions,
    serverSuccess,
    serverEmittedFiles,
    serverOptions,
  } as UniversalBuildOutput;
}

export default createBuilder<
  json.JsonObject & UniversalBuildOptions,
  UniversalBuildOutput
>(ngUniversalBuild);
