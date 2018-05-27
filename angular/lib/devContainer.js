const { concatMap, map } = require('rxjs/operators');

const Runtime = require('../../lib/devContainer');

Runtime.extendRuntime(module, {
  async getBuilderContext(project) {
    const {
      architect$,
      prepareBuilder,
      logger
    } = require('./ng-devkit');

    if (!this._builderContext) {
      this._builderContext = {};
    }

    if (!this._builderContext[project]) {
      const targetSpecifier = {
        project,
        target: 'udk'
      };

      const partialBuilderContext = { logger };

      if (process.argv.length === 3 && process.argv[2][0] !== '-') {
        targetSpecifier.configuration = process.argv[2];
      } else if (process.argv.length > 2) {
        let configuration;

        for (let i = 2; i < process.argv.length; ++i) {
          let arg = process.argv[i];

          if (arg[0] === '-') {
            if (arg === '-c' || arg === '-configuration' || arg === '--configuration') {
              configuration = process.argv[i + 1];

              break;
            }

            if (arg.startsWith('-c=') || arg.startsWith('-configuration=') || arg.startsWith('--configuration=')) {
              configuration = arg.split('=')[1];

              break;
            }
          }
        }

        if (configuration) {
          targetSpecifier.configuration = configuration;
        }
      }

      this._builderContext[project] = architect$.pipe(
        concatMap(architect => prepareBuilder(architect, targetSpecifier, partialBuilderContext))
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
