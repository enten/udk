// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

module.exports = {
  autoRestart: false,
  hmr: {
    enable: true,
    configs: undefined, // restrict HMR to configs which has its name in that option
    entries: ['main', 'index'], // restrict HMR to entries which has its name in that option
    entriesNode: ['server'], // concatenated with hmr.entries => ['server', 'main', 'index']
    entriesWeb: ['browser'], // concatenated with hmr.entries => ['browser', 'main', 'index']
    hotPollInterval: 1000,
    hotMiddleware: {
      path: '/__webpack_hmr'
    },
    hotMiddlewareClient: {
      overlay: true
    }
  },
  logger: console,
  metadirs: [],
  metafiles: [
    'udk.container.ts',
    'webpack.config.js',
  ],
  processTitle: 'udk-ctnr',
  topModuleEntries: [
    /^source-map-support/,
  ],
  watchOptions: {
    aggregateTimeout: 200,
  },
  webpackConfig: './webpack.config.js',

  bootstrap(container) {
    this.logger.info(`> bootstrap container (pid: ${container.proc.pid})`);
  },
  onUp(container) {
    this.logger.info(`>> container up (pid: ${container.proc.pid})`);
  },
  onDown(container) {
    this.logger.info('>> container down', { pid: container.proc.pid });
  },

  onCompilerShouldEmit(compiler, compilation) {
    this.logger.info(`>>> [${compiler.name}] compiler should emit`);

    return true;
  },
  onCompilerWatchRun(compiler, done) {
    this.logger.info(`>>> [${compiler.name}] watchRun`);
    done();
  },
  onCompilerBeforeCompile(compiler, compilationParams, done) {
    this.logger.info(`>>> [${compiler.name}] beforeCompile`);
    done();
  },
  onCompilerCompile(compiler, compilationParams) {
    this.logger.info(`>>> [${compiler.name}] compile`);
  },
  onCompilerThisCompilation(compiler, compilation, compilationParams) {
    this.logger.info(`>>> [${compiler.name}] thisCompilation`);
  },
  onCompilerCompilation(compiler, compilation, compilationParams) {
    this.logger.info(`>>> [${compiler.name}] compilation`);
  },
  onCompilerMake(compiler, compilation, done) {
    this.logger.info(`>>> [${compiler.name}] make`);
    done();
  },
  // onCompilerAfterCompile(compiler, compilation, done) {
  //   this.logger.info(`>>> [${compiler.name}] afterCompile`);
  //   done();
  // },
  onCompilerEmit(compiler, compilation, done) {
    this.logger.info(`>>> [${compiler.name}] emit`);
    done();
  },
  onCompilerAfterEmit(compiler, compilation, done) {
    this.logger.info(`>>> [${compiler.name}] afterEmit`);
    done();
  },
  onCompilerDone(compiler, compilation, done) {
    this.logger.info(`>>> [${compiler.name}] done`);

    if (done) {
      done();
    }
  },
  onCompilerFailed(compiler, err) {
    this.logger.info(`>>> [${compiler.name}] failed`);
  },
  onCompilerInvalid(compiler, fileName, changeTime) {
    this.logger.info(`>>> [${compiler.name}] invalid: ${fileName}`);
  },
  onCompilerWatchClose(compiler) {
    this.logger.info(`>>> [${compiler.name}] watchClose`);
  },
  onBundleAvailable(bundle) {
    this.logger.info(`>>> [${bundle.compiler.name}] bundleAvailable ${bundle.mainOutputPath}`);
  },
  prepareWebpackCompiler(compiler) {
    this.logger.info(`>> prepare compiler ${compiler.name}`);
  },
  prepareWebpackConfig(compiler) {
    this.logger.info(`>> prepare webpack config ${compiler.name}`);
  },
  printCompilerStats(stats) {
    this.logger.info(stats.toString({ colors: true }));
  },
  beforeRequireNodeBundle(compiler, mainOutputPath, stats) {
    this.logger.info(`>>> [${compiler.name}] before require node bundle`);
  },
  requestDecorator(bundle, req, res, next) {
    this.logger.info(`>>> [${bundle.name}] http request ${req.url}`);

    next();
  },
  injectWebpackStats(compilerStats, req, res) {
    const webpackStats = {};

    for (const name in compilerStats) {
      webpackStats[name] = compilerStats[name].toJson('verbose');
    }

    res.locals = res.locals || Object.create(null);
    res.locals.webpackStats = webpackStats;
  }
};
