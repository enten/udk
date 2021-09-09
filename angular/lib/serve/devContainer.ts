// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import webpack = require('webpack');
import wpc = require('webpack-plugin-compat');

import {
  Architect,
  BuilderContext,
  Target,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { WorkspaceNodeModulesArchitectHost } from '@angular-devkit/architect/node';
import { BuildResult, WebpackLoggingCallback } from '@angular-devkit/build-webpack';
import { json, logging, schema, virtualFs, workspaces } from '@angular-devkit/core';
import { NodeJsSyncHost, createConsoleLogger } from '@angular-devkit/core/node';

import {
  DevContainerAPI,
  DevContainerArgs,
  DevContainerConfig,
  DevContainerFactory,
  DevContainerRuntime,
} from '../../../lib/devContainer';
import { findUp } from '../../../lib/util/findUp';

import {
  BrowserBuilderInitContext,
  BrowserBuilderOptions,
  ServerBuilderInitContext,
  ServerBuilderOptions,
  UniversalBuildOptions,
  createBrowserBuilderFinalizer,
  createLoggingCallback,
  createServerBuilderFinalizer,
  createUniversalCompilationOutput,
  createUniversalWebpackConfig,
  initializeBrowserBuilder,
  initializeServerBuilder,
} from '../build';

export type NgContainerAPI = DevContainerAPI;

export interface NgContainerConfig extends DevContainerConfig {
  angularProject?: string;
}

export interface NgContainerFactory extends DevContainerFactory {
  (proc: NodeJS.Process): NgContainerAPI;
}

export interface NgContainerArgs extends DevContainerArgs {
  target: string;
  verbose: boolean;
}


export const ANUGULAR_CONFIG_NAMES = [
  'angular.json',
  '.angular.json',
  'workspace.json',
  '.workspace.json',
];


export class NgContainer extends DevContainerRuntime {
  args: NgContainerArgs;

  readonly architectLogger: logging.LoggerApi;

  firstCompilation = true;
  firstCompilationFailed = false;
  rebootCalled = false;

  webpackLogging: WebpackLoggingCallback;

  angularConfigPath: string;
  registry: schema.SchemaRegistry;
  host: virtualFs.Host<fs.Stats>;
  workspace: workspaces.WorkspaceDefinition;
  architectHost: WorkspaceNodeModulesArchitectHost;
  architect: Architect;
  universalOptions: UniversalBuildOptions;
  browserOptions: BrowserBuilderOptions;
  browserBuilderInitContext: BrowserBuilderInitContext;
  serverOptions: ServerBuilderOptions;
  serverBuilderInitContext: ServerBuilderInitContext;
  builderContext: BuilderContext;

  constructor(readonly runtimePath: string, readonly proc: NodeJS.Process) {
    super(runtimePath, proc);

    /** Create the DevKit Logger used through the CLI. */
    this.architectLogger = createConsoleLogger(this.args.verbose);
    this.logger = this.createArchitectLoggerAdapter(this.architectLogger);
    this.webpackLogging = createLoggingCallback(this.architectLogger, {
      verbose: this.args.verbose,
      colors: true,
    });
  }

  async validateTargetOptions<T>(targetString: string, overrides?: Partial<T>): Promise<T> {
    const target = targetFromTargetString(targetString);
    const builderName = await this.architectHost.getBuilderNameForTarget(target);
    const builderOptionsRaw = await this.architectHost.getOptionsForTarget(target);
    const builderOptions = await this.validateBuilderOptions<T>(
      builderOptionsRaw as json.JsonObject,
      builderName,
    );

    return { ...builderOptions, ...overrides };
  }

  async validateBuilderOptions<T>(options: json.JsonObject, builderName: string): Promise<T> {
    const builderInfo = await this.architectHost.resolveBuilder(builderName);

    if (!builderInfo) {
      throw new Error(`No builder info were found for builder ${JSON.stringify(builderName)}.`);
    }

    const validate = await this.registry.compile(builderInfo.optionSchema).toPromise();
    const validation = await validate(options).toPromise();

    if (!validation.success) {
      throw new json.schema.SchemaValidationException(validation.errors);
    }

    return validation.data as unknown as T;
  }

  async bootstrap() {
    const currentPath = this.proc.cwd();

    this.angularConfigPath = findUp(ANUGULAR_CONFIG_NAMES, currentPath) as string;

    if (!this.angularConfigPath) {
      throw new Error(
        `Workspace configuration file (${ANUGULAR_CONFIG_NAMES.join(', ')}) `
        + `cannot be found in '${currentPath}' or in parent directories.`,
      );
    }

    const root = path.dirname(this.angularConfigPath);

    this.registry = new schema.CoreSchemaRegistry();
    this.registry.addPostTransform(schema.transforms.addUndefinedDefaults);

    this.host = new NodeJsSyncHost();

    const { workspace } = await workspaces.readWorkspace(
      this.angularConfigPath,
      workspaces.createWorkspaceHost(this.host),
    );
    this.workspace = workspace;

    this.architectHost = new WorkspaceNodeModulesArchitectHost(this.workspace, root);
    this.architect = new Architect(this.architectHost, this.registry);

    const targetString = this.args.target;

    if (!targetString) {
      throw new Error('Must either have --target');
    }

    this.universalOptions = await this.validateTargetOptions(targetString);
    this.browserOptions = await this.validateTargetOptions<BrowserBuilderOptions>(
      this.universalOptions.browserTarget,
      { watch: true },
    );
    this.serverOptions = await this.validateTargetOptions<ServerBuilderOptions>(
      this.universalOptions.serverTarget,
      { watch: true },
    );

    const udkTarget = targetFromTargetString(targetString);
    const udkBuilderName = await this.architectHost.getBuilderNameForTarget(udkTarget);
    const udkBuilderInfo = await this.architectHost.resolveBuilder(udkBuilderName);

    this.builderContext = {
      builder: udkBuilderInfo,
      workspaceRoot: root,
      currentDirectory: path.dirname(currentPath),
      target: udkTarget,
      logger: this.architectLogger,
      id: 0,
      getBuilderNameForTarget: (target: Target) => {
        return this.architectHost.getBuilderNameForTarget(target);
      },
      getProjectMetadata: (target: string | Target): Promise<json.JsonObject | null> => {
        return this.architectHost.getProjectMetadata(target);
      },
      getTargetOptions: (target: Target) => {
        return this.architectHost.getOptionsForTarget(target);
      },
      validateOptions: (options: json.JsonObject, builderName: string) => {
        return this.validateBuilderOptions(options, builderName);
      },
    } as unknown as BuilderContext;

    await super.bootstrap();

    return this;
  }

  // getProjectTarget(
  //   args: NgContainerArgs,
  //   workspace: experimental.workspace.Workspace,
  // ): Target {
  //   const argsProjectTarget = makeTargetSpecifier(args.project || '');

  //   const { config } = this.loadConfig(args);
  //   const configProjectTarget = makeTargetSpecifier(config.angularProject || '');

  //   const project = argsProjectTarget.project
  //     || configProjectTarget.project
  //     || workspace.getDefaultProjectName()
  //     || undefined;

  //   let target = args.target
  //     || argsProjectTarget.target
  //     || configProjectTarget.target
  //     || undefined;

  //   if (project && !target) {
  //     const projectTargets = workspace.getProjectTargets(project);

  //     for (const targetName in projectTargets) {
  //       const targetDesc = projectTargets[targetName];

  //       if (targetDesc && targetDesc.builder === 'udk:udk-builder') {
  //         target = targetName;
  //         break;
  //       }
  //     }
  //   }

  //   const configuration = args.configuration
  //     || argsProjectTarget.configuration
  //     || configProjectTarget.configuration
  //     || undefined;

  //   if (configuration) {
  //     return { project, target, configuration } as Target;
  //   }

  //   return { project, target } as Target;
  // }

  createArchitectLoggerAdapter(architectLogger: logging.LoggerApi): Console {
    const createLogFn = (logFnName: 'debug' | 'info' | 'warn' | 'error' | 'fatal') => {
      const logFn = architectLogger[logFnName].bind(architectLogger);

      // tslint:disable-next-line: no-any
      return (...args: any[]) => logFn(util.format.apply(util, args));
    };

    const logger = new console.Console(this.proc.stdout);
    logger.log = createLogFn('info');
    logger.info = createLogFn('info');
    logger.warn = createLogFn('warn');
    logger.error = createLogFn('error');

    return logger;
  }

  async getWebpackConfig() {
    this.browserBuilderInitContext = await initializeBrowserBuilder(
      this.universalOptions,
      this.browserOptions,
      this.builderContext,
      this.host,
    );

    this.serverBuilderInitContext = await initializeServerBuilder(
      this.universalOptions,
      this.browserOptions,
      this.serverOptions,
      this.builderContext,
    );

    return createUniversalWebpackConfig(
      this.browserBuilderInitContext.config,
      this.serverBuilderInitContext.config,
    );
  }


  async onShutUp(config: DevContainerConfig) {
    const browserBuilderFinalizer = createBrowserBuilderFinalizer(
      this.builderContext,
      this.host,
      this.browserBuilderInitContext,
    );
    const serverBuilderFinalizer = createServerBuilderFinalizer(
      this.builderContext,
      this.serverBuilderInitContext,
    );
    let startTime = Date.now();

    wpc.for('NgContainerStartTimePlugin').tap(
      this.compiler,
      'watchRun',
      () => {
        startTime = Date.now();
      },
    );

    wpc.for('NgContainerFinalizersPlugin').tap(
      this.compiler,
      'done',
      async (multiStats: webpack.MultiStats & { hasErrors: () => boolean; }) => {
        const universalBuildResult = createUniversalCompilationOutput(multiStats);

        await browserBuilderFinalizer(startTime, {
          success: universalBuildResult.browserSuccess,
          webpackStats: universalBuildResult.browserStats.toJson(),
          emittedFiles: universalBuildResult.browserEmittedFiles,
        } as BuildResult);

        await serverBuilderFinalizer({
          success: universalBuildResult.serverSuccess,
          webpackStats: universalBuildResult.serverStats.toJson(),
          emittedFiles: universalBuildResult.serverEmittedFiles,
        } as BuildResult);
      },
    );

    wpc.for('NgContainerInvalidPlugin').tap(
      this.compiler,
      'done',
      (stats: webpack.Stats) => {
        if (this.firstCompilation && stats.hasErrors()) {
          this.firstCompilationFailed = true;
        }

        this.firstCompilation = false;
      },
    );

    wpc.for('NgContainerInvalidPlugin').tap(
      this.compiler,
      'invalid',
      () => {
        if (this.firstCompilationFailed && !this.rebootCalled) {
          this.logger.warn('\nWARN: full rebuild...');

          this.rebootCalled = true;
          this.run();
        }
      },
    );

    await super.onShutUp(config);
  }

  printCompilerStats(
    _config: NgContainerConfig,
    _multiStats: webpack.Stats,
  ) {
    this.webpackLogging(_multiStats, this.webpackConfig as webpack.Configuration);

    if (this.firstCompilationFailed) {
      this.logger.warn(
        '\nWARN: First compilation has failed.\nNext compilation needs full rebuild',
      );
    }
  }

  loadConfig(args: NgContainerArgs) {
    return super.loadConfig({
      ...args,
      config: undefined,
    }) as { config: NgContainerConfig, configPath?: string };
  }

  parseProcessArgsOptions() {
    const opts = super.parseProcessArgsOptions();

    opts.alias = { ...opts.alias, t: 'target' };
    opts.string = [ ...(opts.string || []), 'target' ];

    return opts;
  }
}

export default NgContainer.export(module) as NgContainerFactory;
