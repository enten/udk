const { Architect } = require('@angular-devkit/architect');
const { BrowserBuilder, DevServerBuilder } = require('@angular-devkit/build-angular');
const { NodeJsSyncHost, createConsoleLogger } = require('@angular-devkit/core/node');
const { logging/*, normalize*/, resolve } = require('@angular-devkit/core');

const { WorkspaceLoader } = require('@angular/cli/models/workspace-loader');

const { of } = require('rxjs/observable/of');
const { concatMap } = require('rxjs/operators/concatMap');
const { map } = require('rxjs/operators/map');

const host = new NodeJsSyncHost();
const architect$ = loadWorkspaceAndArchitect(host);

const logger = createConsoleLogger();

function createWebpackConfig(targetSpecifier, partialWebpackConfig) {
  if (typeof partialWebpackConfig === 'string') {
    partialWebpackConfig = { name: partialWebpackConfig };
  }

  return architect$.pipe(
    concatMap(architect => prepareBuilder(architect, targetSpecifier, {
      logger
    })),
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
    })
  );
}

function createWebpackConfigForTarget(target, targetSpecifier, partialWebpackConfig) {
  return createWebpackConfig({
    ...targetSpecifier,
    target
  }, partialWebpackConfig);
}

function loadArchitect(workspace) {
  const architect = new Architect(workspace);

  return architect.loadArchitect();
}

function loadWorkspace(host) {
  const workspaceLoader = new WorkspaceLoader(host);

  return workspaceLoader.loadWorkspace();
}

function loadWorkspaceAndArchitect(host) {
  return loadWorkspace(host).pipe(
    concatMap(loadArchitect)
  );
}

function prepareBuilder(architect, targetSpecifier, partialBuilderContext = {}) {
  let builderConfig = architect.getBuilderConfiguration(targetSpecifier);
  let builderDescription;

  return architect.getBuilderDescription(builderConfig).pipe(
    concatMap((description) => {
      builderDescription = description;

      return architect.validateBuilderOptions(builderConfig, builderDescription);
    }),
    map((validatedBuilderConfig) => {
      const context = {
        architect,
        host: architect._workspace.host,
        workspace: architect._workspace,
        // logger: new logging.NullLogger(),
        ...partialBuilderContext
      };

      const builder = architect.getBuilder(builderDescription, context);

      return {
        builder,
        builderConfig,
        builderDescription,
        targetSpecifier
      };
    })
  );
}

function prepareWebpackConfig({
  builder,
  builderConfig,
  builderDescription,
  targetSpecifier
}) {
  let builderConfigOptions = builderConfig.options;
  let builderConfigOptions$ = of(builderConfigOptions);

  let devServerBuilder;
  let devServerBuilderConfig;

  if (builder instanceof DevServerBuilder) {
    devServerBuilder = builder;
    devServerBuilderConfig = devServerBuilderConfig;

    builder = new BrowserBuilder(builder.context);

    builderConfigOptions$ = devServerBuilder._getBrowserOptions(builderConfigOptions);
  }
  
  return builderConfigOptions$.pipe(
    map((options) => {
      const { root } = builder.context.workspace;
      const projectRoot = resolve(root, builderConfig.root);

      const webpackConfig = builder.buildWebpackConfig(root, projectRoot, options);

      return webpackConfig;
    })
  );
}

module.exports = {
  architect$,
  host,
  logger,
  createWebpackConfig,
  createWebpackConfigForTarget,
  loadArchitect,
  loadWorkspace,
  loadWorkspaceAndArchitect,
  prepareBuilder,
  prepareWebpackConfig
};