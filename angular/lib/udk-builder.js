
const { BrowserBuilder } = require('@angular-devkit/build-angular/src/browser');
const { ServerBuilder } = require('@angular-devkit/build-angular/src/server');
const { addFileReplacements } = require('@angular-devkit/build-angular/src/utils');
const {
  statsErrorsToString,
  statsToString,
  statsWarningsToString
} = require('@angular-devkit/build-angular/src/angular-cli-files/utilities/stats');
const webpackConfigsUtils = require('@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/utils');

let { getWebpackStatsConfig } = webpackConfigsUtils;

if (!getWebpackStatsConfig) {
  getWebpackStatsConfig = require('@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/stats').getWebpackStatsConfig;
}

const {
  getSystemPath,
  join,
  normalize,
  resolve,
  virtualFs
} = require('@angular-devkit/core');

const rimraf = require('rimraf');
const supportsColor = require('supports-color');
const webpackMerge = require('webpack-merge');

const {
  Observable,
  from: fromPromise,
  of: observableOf,
  zip
} = require('rxjs');
const { concatMap, map } = require('rxjs/operators');

const udk = require('../../lib/udk');

class UdkBuilder {
  constructor(context) {
    this.context = context;
  }

  run(builderConfig) {
    return this.buildWebpackConfig(builderConfig.options).pipe(
      concatMap((multiConfig) => new Observable((obs) => {
        if (builderConfig.options.deleteOutputPath) {
          this._deleteOutputPath(multiConfig);
        };

        try {
          const webpackCompiler = udk(multiConfig);

          webpackCompiler.run((err, stats) => {
            if (err) {
              return obs.error(err);
            }

            this._printStats(stats, builderConfig.options.verbose);

            obs.next({ success: !stats.hasErrors() });
            obs.complete();
          });
        } catch (err) {
          if (err) {
            this.context.logger.error(
              '\nAn error occured during the build:\n' + ((err && err.stack) || err));
          }
          throw err;
        }
      }))
    );
  }

  buildWebpackConfig(options) {
    const {
      main,
      browserTarget,
      serverTarget,
      partialBrowserConfig,
      partialServerConfig,
      fileReplacements,
      deleteOutputPath
    } = options;

    return zip(
      this._getWebpackConfigForBuilder(
        BrowserBuilder,
        browserTarget,
        partialBrowserConfig
      ),
      this._getWebpackConfigForBuilder(
        ServerBuilder,
        serverTarget,
        partialServerConfig,
        fileReplacements
      )
    ).pipe(
      map((multiConfig) => {
        const [
          browserConfig,
          serverConfig
        ] = multiConfig;

        if (!browserConfig.name) {
          browserConfig.name = 'browser';
        }

        if (!multiConfig[1].name) {
          serverConfig.name = 'server';
        }

        // set browserConfig as serverConfig's dependency
        serverConfig.dependencies = [ browserConfig.name ];

        return multiConfig;
      })
    );
  }

  _applyPartialWebpackConfig(webpackConfig, partialWebpackConfig$) {
    if (partialWebpackConfig$ && typeof partialWebpackConfig$.then === 'function') {
      partialWebpackConfig$ = fromPromise(partialWebpackConfig$);
    } else if (!partialWebpackConfig$ || typeof partialWebpackConfig$.subscribe !== 'function') {
      partialWebpackConfig$ = observableOf(partialWebpackConfig$);
    }

    return partialWebpackConfig$.pipe(
      concatMap((partialWebpackConfig) => {
        if (typeof partialWebpackConfig === 'string') {
          const partialWebpackConfigPath = getSystemPath(resolve(
            this.context.workspace.root,
            partialWebpackConfig
          ));
    
          partialWebpackConfig = require(partialWebpackConfigPath);
        }

        if (typeof partialWebpackConfig === 'function') {
          return this._applyPartialWebpackConfig(
            webpackConfig,
            partialWebpackConfig(webpackConfig)
          );
        }

        if (typeof partialWebpackConfig === 'object') {
          webpackConfig = webpackMerge(webpackConfig, partialWebpackConfig);
        }

        return observableOf(webpackConfig);
      })
    );
  }

  _getBuilderConfig(projectTarget) {
    const architect = this.context.architect;
    const [project, target, configuration] = projectTarget.split(':');
    // Override browser build watch setting.
    // const overrides = { watch: options.watch };
    const targetSpec = { project, target, configuration/*, overrides*/ };
    const builderConfig = architect.getBuilderConfiguration(targetSpec);

    return architect.getBuilderDescription(builderConfig).pipe(
      concatMap(builderDescription => {
        return architect.validateBuilderOptions(builderConfig, builderDescription)
      })
    );
  }

  _deleteOutputPath(webpackConfig) {
    if (Array.isArray(webpackConfig)) {
      return webpackConfig.forEach((c) => {
        this._deleteOutputPath(c);
      });
    }

    rimraf.sync(webpackConfig.output.path);
  }

  _getWebpackConfigForBuilder(BuilderCtor, projectTarget, partialWebpackConfig, fileReplacements = []) {
    const { root } = this.context.workspace;
    const host = new virtualFs.AliasHost(this.context.host);

    let options;
    let projectRoot;

    return this._getBuilderConfig(projectTarget).pipe(
      concatMap((builderConfig) => {
        options = builderConfig.options;
        projectRoot = resolve(root, builderConfig.root);

        return observableOf(null);
      }),
      concatMap(() => addFileReplacements(root, host, fileReplacements)),
      concatMap(() => addFileReplacements(root, host, options.fileReplacements || [])),
      concatMap(() => {
        const builder = new BuilderCtor(this.context);
        let webpackConfig;

        webpackConfig = builder.buildWebpackConfig(
          root,
          projectRoot,
          host,
          options
        );

        return this._applyPartialWebpackConfig(webpackConfig, partialWebpackConfig);
      })
    );
  }

  _printStats(stats, verbose) {
    if (Array.isArray(stats.stats)) {
      return stats.stats.forEach((s) => {
        this._printStats(s, verbose)
      });
    }

    const statsConfig = getWebpackStatsConfig(verbose);
    statsConfig.colors = supportsColor.stdout;

    const statsTitle = 'Child: ' + stats.compilation.name + (verbose ? '\n' : '');

    if (verbose) {
      const jsonString = stats.toString(statsConfig)
        .split('\n')
        .map(line => '  ' + line)
        .join('\n');

      this.context.logger.info(statsTitle + jsonString);
    } else {
      const json = stats.toJson(statsConfig);
      const jsonString = statsToString(json, statsConfig)
        .split('\n')
        .map(line => '  ' + line)
        .join('\n');

      this.context.logger.info(statsTitle + jsonString);
      if (stats.hasWarnings()) {
        this.context.logger.warn(statsWarningsToString(json, statsConfig));
      }
      if (stats.hasErrors()) {
        this.context.logger.error(statsErrorsToString(json, statsConfig));
      }
    }
  }
}

module.exports = {
  default: UdkBuilder,
  UdkBuilder
};
