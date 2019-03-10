// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import {
  Architect,
  Builder,
  BuilderConfiguration,
  BuilderContext,
  BuilderDescription,
  TargetSpecifier,
} from '@angular-devkit/architect';

import { BrowserBuilder, DevServerBuilder } from '@angular-devkit/build-angular';
import { experimental, logging, resolve, virtualFs } from '@angular-devkit/core';
import { NodeJsSyncHost, createConsoleLogger } from '@angular-devkit/core/node';
import { WorkspaceLoader } from '@angular/cli/models/workspace-loader';

import { Observable, from as fromToObservable, of as observableOf } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';

import * as webpack from 'webpack';

export const host = new NodeJsSyncHost();
export const architect$: Observable<Architect> = loadWorkspaceAndArchitect(host);

export const ngLogger: logging.Logger = createConsoleLogger();

export type WebpackConfigBuilderContext<OptionsT> = {
  builder: Builder<OptionsT>;
  builderConfig: BuilderConfiguration<OptionsT>;
  builderDescription: BuilderDescription;
  targetSpecifier: TargetSpecifier;
};

export function createWebpackConfig<OptionsT>(
  targetSpecifier: TargetSpecifier,
  partialWebpackConfig?: any, // tslint:disable-line:no-any
): Observable<webpack.Configuration> {
  if (typeof partialWebpackConfig === 'string') {
    partialWebpackConfig = { name: partialWebpackConfig };
  }

  return architect$.pipe(
    concatMap(architect => prepareBuilder<OptionsT>(
      architect,
      targetSpecifier,
      { logger: ngLogger },
    )),
    concatMap(prepareWebpackConfig),
    map((webpackConfig) => {
      if (partialWebpackConfig) {
        const webpackMerge = require('webpack-merge');

        if (typeof partialWebpackConfig === 'function') {
          webpackConfig = partialWebpackConfig(webpackConfig) || webpackConfig;
        } else {
          webpackConfig = webpackMerge(webpackConfig, partialWebpackConfig);
        }
      }

      return webpackConfig;
    }),
  );
}

export function createWebpackConfigForTarget<OptionsT>(
  target: string,
  targetSpecifier: TargetSpecifier,
  partialWebpackConfig?: any, // tslint:disable-line:no-any
): Observable<webpack.Configuration> {
  return createWebpackConfig<OptionsT>({ ...targetSpecifier, target }, partialWebpackConfig);
}

export function loadArchitect(workspace: experimental.workspace.Workspace): Observable<Architect> {
  const architect = new Architect(workspace);

  return architect.loadArchitect();
}

export function loadWorkspace(host: virtualFs.Host): Observable<experimental.workspace.Workspace> {
  const workspaceLoader = new WorkspaceLoader(host as any); // tslint:disable-line: no-any
  const workspaceLoading = workspaceLoader.loadWorkspace() as any; // tslint:disable-line: no-any

  // support @angular/cli v7.1.0
  if (typeof (workspaceLoading as any).then === 'function') { // tslint:disable-line: no-any
    return fromToObservable(workspaceLoading) as Observable<experimental.workspace.Workspace>;
  }

  return workspaceLoading;
}

export function loadWorkspaceAndArchitect(host: virtualFs.Host): Observable<Architect> {
  return loadWorkspace(host).pipe(concatMap(loadArchitect));
}

export function makeTargetSpecifier(
  targetSpecString: string,
  defaultSpec?: TargetSpecifier,
): TargetSpecifier {
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

export function prepareBuilder<OptionsT>(
  architect: Architect,
  targetSpecifier: TargetSpecifier,
  partialBuilderContext: Partial<BuilderContext> = {},
): Observable<WebpackConfigBuilderContext<OptionsT>> {
  const builderConfig: BuilderConfiguration<OptionsT> = architect.getBuilderConfiguration(
    targetSpecifier,
  );
  let builderDescription: BuilderDescription;

  return architect.getBuilderDescription(builderConfig).pipe(
    concatMap((description) => {
      builderDescription = description;

      return architect.validateBuilderOptions(builderConfig, builderDescription);
    }),
    map((_validatedBuilderConfig) => {
      const context: BuilderContext = {
        architect,
        host: architect['_workspace'].host,
        workspace: architect['_workspace'],
        logger: new logging.NullLogger(),
        ...partialBuilderContext,
      };

      const builder = architect.getBuilder<OptionsT>(builderDescription, context);

      return {
        builder,
        builderConfig,
        builderDescription,
        targetSpecifier,
      };
    }),
  );
}

export function prepareWebpackConfig<OptionsT>({
  builder,
  builderConfig,
  // builderDescription,
  // targetSpecifier,
}: WebpackConfigBuilderContext<OptionsT>): Observable<webpack.Configuration> {
  const builderConfigOptions = builderConfig.options;
  let builderConfigOptions$ = observableOf(builderConfigOptions);

  let devServerBuilder: DevServerBuilder;

  if (builder instanceof DevServerBuilder) {
    devServerBuilder = builder;

    builder = (new BrowserBuilder(builder.context)) as {} as Builder<OptionsT>;

    builderConfigOptions$ = devServerBuilder['_getBrowserOptions'](builderConfigOptions);
  }

  return builderConfigOptions$.pipe(
    map((options) => {
      const {
        host,
        root,
      // tslint:disable-next-line:no-any
      } = (builder as any).context.workspace as experimental.workspace.Workspace;

      const projectRoot = resolve(root, builderConfig.root);

      const webpackConfig = (builder as any).buildWebpackConfig( // tslint:disable-line:no-any
        root,
        projectRoot,
        host,
        options,
      );

      return webpackConfig;
  }),
  );
}
