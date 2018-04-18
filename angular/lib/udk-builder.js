
const { BrowserBuilder } = require('@angular-devkit/build-angular/src/browser');
const { ServerBuilder } = require('@angular-devkit/build-angular/src/server');
const { getWebpackStatsConfig } = require('@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/utils');
const {
  statsErrorsToString,
  statsToString,
  statsWarningsToString
} = require('@angular-devkit/build-angular/src/angular-cli-files/utilities/stats');

const { join, normalize, resolve, virtualFs } = require('@angular-devkit/core');

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

        serverConfig.entry = {
          ...serverConfig.entry,
          // move options.serverTarget main into ngmodule entry
          ngmodule: serverConfig.entry.main,
          // set options.main as real main entry
          main: resolve(this.context.workspace.root, main)
        };

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
          const partialWebpackConfigPath = resolve(
            this.context.workspace.root,
            partialWebpackConfig
          );
    
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

  _getWebpackConfigForBuilder(BuilderCtor, projectTarget, partialWebpackConfig, fileReplacements) {
    return this._getBuilderConfig(projectTarget).pipe(
      concatMap((builderConfig) => {
        const builder = new BuilderCtor(this.context);

        const { root } = this.context.workspace;
        const projectRoot = resolve(root, builderConfig.root);

        if (fileReplacements) {
          const host = new virtualFs.AliasHost(this.context.host);

          fileReplacements.forEach(({ src, replaceWith }) => {
            host.aliases.set(
              join(root, normalize(src)),
              join(root, normalize(replaceWith)),
            );
          });

          this.context.host = host;
        }

        let webpackConfig;

        if (BuilderCtor === BrowserBuilder) {
          webpackConfig = builder.buildWebpackConfig(
            root,
            projectRoot,
            this.context.host,
            builderConfig.options
          );
        } else {
          webpackConfig = builder.buildWebpackConfig(
            root,
            projectRoot,
            builderConfig.options
          );
        }


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

    this.context.logger.info('Child ' + stats.compilation.name);

    const json = stats.toJson(statsConfig);

    if (verbose) {
      this.context.logger.info(stats.toString(statsConfig));
    } else {
      this.context.logger.info(statsToString(json, statsConfig));
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
