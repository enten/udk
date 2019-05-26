// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import { Architect, BuilderContext, Target } from '@angular-devkit/architect';
import { WorkspaceNodeModulesArchitectHost } from '@angular-devkit/architect/node';

import { WebpackLoggingCallback } from '@angular-devkit/build-webpack';

import { experimental, json, logging, normalize, schema, virtualFs } from '@angular-devkit/core';
import { NodeJsSyncHost, createConsoleLogger } from '@angular-devkit/core/node';

import webpack = require('webpack');
import wpc = require('webpack-plugin-compat');

import {
  DevContainerAPI,
  DevContainerArgs,
  DevContainerConfig,
  DevContainerFactory,
  DevContainerRuntime,
} from '../../lib/devContainer';
import { createLoggingCallback, deleteConfigOutputPath, makeTargetSpecifier } from './ng-devkit';
import { BuildUdkSchema } from './schema';
import { buildUniversalConfig } from './udk-builder';

import { findUp } from '../../lib/util/findUp';


export type NgContainerAPI = DevContainerAPI;

export interface NgContainerConfig extends DevContainerConfig {
  angularProject?: string;
}

export interface NgContainerFactory extends DevContainerFactory {
  (proc: NodeJS.Process): NgContainerAPI;
}

export interface NgContainerArgs extends DevContainerArgs {
  project?: string;
}


export const ANUGULAR_CONFIG_NAMES = [
  'angular.json',
  '.angular.json',
  'workspace.json',
  '.workspace.json',
];


export class NgContainer extends DevContainerRuntime {
  args: NgContainerArgs;

  firstCompilation = true;
  firstCompilationFailed = false;

  webpackLogging: WebpackLoggingCallback;

  angularConfigPath: string;
  architect: Architect;
  architectHost: WorkspaceNodeModulesArchitectHost;
  architectLogger: logging.LoggerApi;
  builderContext: BuilderContext;
  builderOptions: BuildUdkSchema;
  builderBrowserOptions: BuildUdkSchema;
  host: virtualFs.Host<fs.Stats>;
  registry: schema.SchemaRegistry;
  workspace: experimental.workspace.Workspace;

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

  async bootstrap() {
    // Load workspace configuration file.
    const currentPath = this.proc.cwd();

    this.angularConfigPath = findUp(ANUGULAR_CONFIG_NAMES, currentPath) as string;

    if (!this.angularConfigPath) {
      throw new Error(
        `Workspace configuration file (${ANUGULAR_CONFIG_NAMES.join(', ')}) `
        + `cannot be found in '${currentPath}' or in parent directories.`,
      );
    }

    const root = path.dirname(this.angularConfigPath);
    const configContent = fs.readFileSync(this.angularConfigPath, 'utf-8');
    const workspaceJson = JSON.parse(configContent);

    this.registry = new schema.CoreSchemaRegistry();
    this.registry.addPostTransform(schema.transforms.addUndefinedDefaults);

    this.host = new NodeJsSyncHost();
    this.workspace = new experimental.workspace.Workspace(normalize(root), this.host);

    await this.workspace.loadWorkspaceFromJson(workspaceJson).toPromise();

    this.architectHost = new WorkspaceNodeModulesArchitectHost(this.workspace, root);
    this.architect = new Architect(this.architectHost, this.registry);

    const projectTarget = this.getProjectTarget(this.args, this.workspace);

    if (!projectTarget.project) {
      throw new Error('Must either have a target from the context or a default project.');
    }

    const udkBuilderName = await this.architectHost.getBuilderNameForTarget(projectTarget);
    const udkBuilderInfo = await this.architectHost.resolveBuilder(udkBuilderName);
    const udkBuilderValidate = await this.registry.compile(udkBuilderInfo.optionSchema).toPromise();
    const udkBuilderOptionsRaw = await this.architectHost.getOptionsForTarget(projectTarget);
    const udkBuilderValidation = await udkBuilderValidate(udkBuilderOptionsRaw).toPromise();

    if (!udkBuilderValidation.success) {
      throw new json.schema.SchemaValidationException(udkBuilderValidation.errors);
    }

    this.builderOptions = udkBuilderValidation.data as {} as BuildUdkSchema;

    this.builderContext = {
      builder: udkBuilderInfo,
      workspaceRoot: this.workspace.root,
      currentDirectory: path.dirname(currentPath),
      target: projectTarget,
      logger: this.architectLogger,
      id: 0,
      getBuilderNameForTarget: (target: Target) => {
        return this.architectHost.getBuilderNameForTarget(target);
      },
      getTargetOptions: (target: Target) => {
        return this.architectHost.getOptionsForTarget(target);
      },
      validateOptions: async (options: json.JsonObject, builderName: string) => {
        const builderInfo = await this.architectHost.resolveBuilder(builderName);

        if (!builderInfo) {
          throw new Error(`No builder info were found for builder ${JSON.stringify(builderName)}.`);
        }

        const validate = await this.registry.compile(builderInfo.optionSchema).toPromise();
        const validation = await validate(options).toPromise();

        if (!validation.success) {
          throw new json.schema.SchemaValidationException(validation.errors);
        }

        return validation.data;
      },
    } as {} as BuilderContext;

    await super.bootstrap();

    return this;
  }

  getProjectTarget(
    args: NgContainerArgs,
    workspace: experimental.workspace.Workspace,
  ): Target {
    const argsProjectTarget = makeTargetSpecifier(args.project || '');

    const { config } = this.loadConfig(args);
    const configProjectTarget = makeTargetSpecifier(config.angularProject || '');

    const project = argsProjectTarget.project
      || configProjectTarget.project
      || workspace.getDefaultProjectName()
      || undefined;

    let target = args.target
      || argsProjectTarget.target
      || configProjectTarget.target
      || undefined;

    if (project && !target) {
      const projectTargets = workspace.getProjectTargets(project);

      for (const targetName in projectTargets) {
        const targetDesc = projectTargets[targetName];

        if (targetDesc && targetDesc.builder === 'udk:udk-builder') {
          target = targetName;
          break;
        }
      }
    }

    const configuration = argsProjectTarget.configuration
      || configProjectTarget.configuration
      || undefined;

    return {
      project,
      target,
      configuration,
    } as Target;
  }

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
    const { config: multiConfig } = await buildUniversalConfig(
      this.builderOptions,
      this.builderContext,
      this.host,
      false,
    );

    if (this.builderOptions.deleteOutputPath) {
      await Promise.all(multiConfig.map(config => deleteConfigOutputPath(
        this.builderContext.workspaceRoot,
        this.host,
        config,
      )));
    }

    return multiConfig;
  }

  async onShutUp(config: DevContainerConfig) {
    let rebootCalled = false;

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
      (fileName: string) => {
        this.logger.info(`File changed: ${fileName}`);

        if (this.firstCompilationFailed && !rebootCalled) {
          this.logger.warn('\nWARN: full rebuild...');

          rebootCalled = true;
          this.run();
        }
      },
    );

    await super.onShutUp(config);
  }

  printCompilerStats(
    _config: NgContainerConfig,
    multiStats: webpack.Stats,
  ) {
    this.webpackLogging(multiStats, this.webpackConfig as webpack.Configuration);

    if (this.firstCompilationFailed) {
      this.logger.warn(
        '\nWARN: First compilation has failed.\nNext compilation needs full rebuild',
      );
    }
  }

  loadConfig(args: NgContainerArgs) {
    return super.loadConfig(args) as { config: NgContainerConfig, configPath?: string };
  }

  parseProcessArgsOptions() {
    const opts = super.parseProcessArgsOptions();

    opts.alias = { ...opts.alias, p: 'project' };
    opts.string = ([] as string[]).concat(opts.string || [], 'project');

    return opts;
  }
}

export default NgContainer.export(module) as NgContainerFactory;
