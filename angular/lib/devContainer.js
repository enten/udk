const { concatMap } = require('rxjs/operators/concatMap');
const { map } = require('rxjs/operators/map');

const Runtime = require('../../lib/devContainer');

const {
  architect$,
  prepareBuilder,
  logger
} = require('./ng-devkit');

Runtime.extendRuntime(module, {
  async getBuilderContext(project) {
    if (!this._builderContext) {
      this._builderContext = {};
    }

    if (!this._builderContext[project]) {
      this._builderContext[project] = architect$.pipe(
        concatMap(architect => {
          return prepareBuilder(architect, {
            project,
            target: 'udk'
          }, {
            logger
          })
        })
      ).toPromise();
    }

    return this._builderContext[project];
  },
  getConfigDefaulter (configPath) {
    const defaulter = Runtime.getConfigDefaulter.call(this, configPath);

    defaulter.set('printCompilerStats', async (stats) => {
      const {
        builder,
        builderConfig
      } = await this.getProjectBuilderContext();

      builder._printStats(stats, builderConfig.options.verbose);
    });

    return defaulter;
  },
  async getProjectBuilderContext() {
    return this.getBuilderContext(this.angularProject);
  },
  async getWebpackConfig() {
    const {
      builder,
      builderConfig
    } = await this.getProjectBuilderContext();

    const webpackConfig = await builder.buildWebpackConfig(builderConfig.options).toPromise();

    if (builderConfig.options.deleteOutputPath) {
      builder._deleteOutputPath(webpackConfig);
    }

    return webpackConfig;
  },
  async shutUpContainer (proc, config) {
    this.angularProject = config.angularProject;

    return Runtime.shutUpContainer.call(this, proc, config);
  }
});
