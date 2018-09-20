import { Request, Response } from 'express';

export default { // tslint:disable-line:no-angle-bracket-type-assertion
  autoRestart: false,
  hmr: {
    enable: true,
    configs: undefined, // restrict HMR to configs which has its name in that option
    entries: ['main', 'index'], // restrict HMR to entries which has its name in that option
    entriesNode: ['server'], // concatenated with hmr.entries => ['server', 'main', 'index']
    entriesWeb: ['browser'], // concatenated with hmr.entries => ['browser', 'main', 'index']
    hotPollInterval: 1000,
    hotMiddleware: {
      path: '/__webpack_hmr',
    },
    hotMiddlewareClient: {
      overlay: true,
    },
  },
  logger: console,
  metadirs: [],
  metafiles: [
    'udk.config.ts',
    'webpack.config.ts',
  ],
  processTitle: 'udk-ctnr',
  topModuleEntries: [
    /^source-map-support/,
  ],
  watchOptions: {
    aggregateTimeout: 200,
  },
  webpackConfig: './webpack.config.ts',

  injectWebpackStats(compilerStats: any, req: Request, res: Response) {
    const webpackStats: { [name: string]: any } = {};

    for (const name in compilerStats) {
      webpackStats[name] = compilerStats[name].toJson('verbose');
    }

    res.locals = res.locals || Object.create(null);
    res.locals.webpackStats = webpackStats;
  },
};
