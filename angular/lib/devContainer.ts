// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import { TargetSpecifier } from '@angular-devkit/architect';
import { concatMap } from 'rxjs/operators';
import * as webpack from 'webpack';

import {
  DevContainerAPI,
  DevContainerArgs,
  DevContainerConfig,
  DevContainerFactory,
  DevContainerRuntime,
} from '../../lib/devContainer';

import {
  WebpackConfigBuilderContext,
  architect$,
  makeTargetSpecifier,
  ngLogger,
  prepareBuilder,
} from './ng-devkit';

import { BuildUdkSchema } from './schema';
import UdkBuilder from './udk-builder';

export interface NgBuilderContextMap {
  [project: string]: Promise<WebpackConfigBuilderContext<BuildUdkSchema>>;
}

export interface NgContainerAPI extends DevContainerAPI {

}

export interface NgContainerConfig extends DevContainerConfig {
  angularProject?: string;
}

export interface NgContainerFactory extends DevContainerFactory {
  (proc: NodeJS.Process): NgContainerAPI;
}

export interface NgContainerArgs extends DevContainerArgs {
  project?: string;
}

export class NgContainer extends DevContainerRuntime {
  args: DevContainerArgs;
  logger = ngLogger as {} as Console;

  _builderContext: NgBuilderContextMap = {};

  getBuilderContext(targetSpec: TargetSpecifier) {
    const builderId = [
      targetSpec.project,
      targetSpec.target,
      targetSpec.configuration,
    ].join(':');

    if (!this._builderContext[builderId]) {
      this.debug('[%o] create angular builder context %o', this.proc.pid, builderId);

      const partialBuilderContext = { logger: ngLogger };

      this._builderContext[builderId] = architect$.pipe(
        concatMap(architect => prepareBuilder<BuildUdkSchema>(
          architect,
          targetSpec,
          partialBuilderContext,
        )),
      ).toPromise();
    }

    return this._builderContext[builderId];
  }

  async getProjectBuilderContext(config: NgContainerConfig) {
    const targetDefault = makeTargetSpecifier('angular:udk');
    let target = targetDefault;

    if (config.angularProject) {
      target = makeTargetSpecifier(config.angularProject, targetDefault);
    }

    return this.getBuilderContext(target);
  }

  async getWebpackConfig(config: NgContainerConfig) {
    const {
      builder,
      builderConfig,
    } = await this.getProjectBuilderContext(config);

    const _builder = builder as UdkBuilder;

    const { webpackConfigs } = await _builder.buildWebpackConfig(builderConfig.options).toPromise();

    if (builderConfig.options.deleteOutputPath) {
      _builder._deleteOutputPath(webpackConfigs);
    }

    return webpackConfigs;
  }

  printCompilerStats(config: NgContainerConfig, stats: webpack.Stats) {
    this.getProjectBuilderContext(config)
      .then(({ builder, builderConfig }) => {
        const printStats = (builder as any)._printStats.bind(builder); // tslint:disable-line:no-any

        printStats(stats, (builderConfig.options as {} as { verbose: boolean }).verbose);
      })
      .catch(this.logger.error);
  }

  parseProcessArgs(): NgContainerArgs {
    return super.parseProcessArgs();
  }

  parseProcessArgsOptions() {
    const opts = super.parseProcessArgsOptions();

    opts.alias = { ...opts.alias, p: 'project' };
    opts.string = ([] as string[]).concat(opts.string || [], 'project');

    return opts;
  }

  async prepareConfig(config: NgContainerConfig) {
    if (this.args.project) {
      config.angularProject = this.args.project;
    }

    await super.prepareConfig(config);
  }
}

export default NgContainer.export(module) as NgContainerFactory;
