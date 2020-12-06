// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

import debug = require('debug');
import { DepGraph } from 'dependency-graph';
import wpc = require('../webpack-plugin-compat');

export const MultiCompiler1: MultiCompilerStatic = require('webpack/lib/MultiCompiler');

export interface MultiCompilerStatic extends webpack.MultiCompiler {
  new(compilers: webpack.Compiler[] | WebpackCompilerMap): webpack.MultiCompiler;
}

export interface WebpackCompilerMap {
  [name: string]: webpack.Compiler;
}

export interface WebpackCompilerCompileFn {
  (
    callback: (err: Error | null, compilation?: webpack.compilation.Compilation) => void,
  ): void;
}

export interface WebpackCompiler2 extends webpack.Compiler {
  _udk: {
    callbacks: ((err?: Error) => void)[];
    dependants: WebpackCompiler2[];
    dependencies: WebpackCompiler2[];
    lastChange?: { fileName: string; changeTime: number; };
    lastError?: Error | null;
    lastStats?: { [key: string]: any; } | null; // tslint:disable-line:no-any
    running: boolean;
    compile: WebpackCompilerCompileFn;
    watch: webpack.Compiler['watch'];
    watchings: webpack.Compiler.Watching[];
  };
  compile: WebpackCompilerCompileFn;
  createCompilation(): webpack.Stats;
}

export enum WebpackCompilerStage {
  environment = 'environment',
  afterEnvironment = 'afterEnvironment',
  entryOption = 'entryOption',
  afterPlugins = 'afterPlugins',
  afterResolvers = 'afterResolvers',
  beforeRun = 'beforeRun',
  run = 'run',
  watchRun = 'watchRun',
  normalModuleFactory = 'normalModuleFactory',
  contextModuleFactory = 'contextModuleFactory',
  beforeCompile = 'beforeCompile',
  compile = 'compile',
  thisCompilation = 'thisCompilation',
  compilation = 'compilation',
  make = 'make',
  afterCompile = 'afterCompile',
  shouldEmit = 'shouldEmit',
  // needAdditionalPass = 'needAdditionalPass',
  // additionalPass = 'additionalPass',
  emit = 'emit',
  afterEmit = 'afterEmit',
  done = 'done',
  failed = 'failed',
  invalid = 'invalid',
  watchClose = 'watchClose',
}

// export const WebpackStageTypeAndArgNames = {
//   'entryOption': [ 'SyncBail', 'context', 'entryOptions' ],
//   'afterPlugins': [ 'AsyncSeries', 'compiler' ],
//   'afterResolvers': [ 'AsyncSeries', 'compiler' ],
//   'environment': [ 'Sync' ],
//   'afterEnvironment': [ 'Sync' ],
//   'beforeRun': [ 'AsyncSeries', 'compiler' ],
//   'run': [ 'AsyncSeries', 'compiler' ],
//   'watchRun': [ 'AsyncSeries', 'compiler' ],
//   'normalModuleFactory': [ 'Sync', 'normalModuleFactory' ],
//   'contextModuleFactory': [ 'Sync', 'contextModuleFactory' ],
//   'beforeCompile': [ 'AsyncSeries', 'compilationParams' ],
//   'compile': [ 'Sync', 'compilationParams' ],
//   'thisCompilation': [ 'Sync', 'compilation', 'compilationParams' ],
//   'compilation': [ 'Sync', 'compilation', 'compilationParams' ],
//   'make': [ 'AsyncParallel', 'compilation' ],
//   'afterCompile': [ 'AsyncSeries', 'compilation' ],
//   'shouldEmit': [ 'SyncBail', 'compilation' ],
//   'needAdditionalPass': [ 'SyncBail', 'compilation' ],
//   'additionalPass': [ 'AsyncSeries' ],
//   'emit': [ 'AsyncSeries', 'compilation' ],
//   'afterEmit': [ 'AsyncSeries', 'compilation' ],
//   'done': [ 'AsyncSeries', 'stats' ],
//   'failed': [ 'Sync', 'error' ],
//   'invalid': [ 'Sync', 'fileName', 'changeTime' ],
//   'watchClose': [ 'Sync' ] as string[],
// };

export default class MultiCompiler extends MultiCompiler1 {
  _udk: {
    depGraph: DepGraph<WebpackCompiler2>;
    overallOrder: string[];
  };

  constructor(compilers: webpack.Compiler[] | WebpackCompilerMap) {
    compilers = parseMultiCompilerInput(compilers);

    const depGraph = createDepGraph(compilers);
    const overallOrder = depGraph.overallOrder();

    compilers = overallOrder.map(compilerName => {
      return prepareCompiler(compilerName, depGraph);
    });

    super(compilers);

    this._udk = {
      depGraph,
      overallOrder,
    };
  }

  getCompiler(name: string) {
    return getCompiler(name, this._udk.depGraph);
  }
}

export function createDepGraph(nodes: webpack.Compiler[]): DepGraph<WebpackCompiler2> {
  const graph = new DepGraph<WebpackCompiler2>({ circular: false });

  nodes.forEach((node) => graph.addNode(node.name, node as WebpackCompiler2));

  nodes.forEach((node) => {
    const depNames = (node as any).dependencies as string[]; // tslint:disable-line:no-any

    if (depNames) {
      depNames.forEach((depName) => {
        graph.addDependency(node.name, depName);
      });
    }
  });

  return graph;
}

export function debugCompilerStage(compiler: webpack.Compiler, stage: WebpackCompilerStage) {
  const dbg = getCompilerDebugger(compiler);
  const stageLevel = Object.keys(WebpackCompilerStage).indexOf(stage);

  // tslint:disable-next-line:no-any
  wpc.for('UdkDebugStagePlugin').tap(compiler, stage, (...args: any[]) => {
    dbg('%o %s', stageLevel, stage);

    const done = args.pop();

    if (typeof done === 'function') {
      done();
    }
  });
}

export function getCancelledCompilation(compiler: WebpackCompiler2) {
  const compilesBadly = compiler._udk.dependencies.filter(d => {
    return d._udk.lastStats ? d._udk.lastStats.hasErrors() : d._udk.lastError;
  });

  if (!compilesBadly.length) {
    return undefined;
  }

  const previousCompilers = compilesBadly.map(c => c.name).join(', ');

  const compilation = compiler.createCompilation() as any; // tslint:disable-line:no-any
  compilation.name = compiler.name;

  compilation.errors.push(new Error(
    // tslint:disable-next-line:max-line-length
    `[udk] MultiCompiler\nCompilation cancelled due to errors in previous compilers: ${previousCompilers}`,
  ));

  // purge compiler filesystem to handle shared file updates from dependencies
  compilation.inputFileSystem.purge();

  // compat: webpack v4 use Set instead of arrays
  if ('hooks' in compiler) {
    compilation.fileDependencies = new Set();
    compilation.contextDependencies = new Set();
    compilation.missingDependencies = new Set();
  } else {
    compilation.fileDependencies = [];
    compilation.contextDependencies = [];
    compilation.missingDependencies = [];
  }

  compilation.createHash();

  return compilation as webpack.compilation.Compilation;
}

export function getCompiler(compilerName: string, depGraph: DepGraph<WebpackCompiler2>) {
  const overallOrder = depGraph.overallOrder();

  const mapping = (name: string) => depGraph.getNodeData(name);
  const sorting = (a: string, b: string) => {
    return overallOrder.indexOf(a) > overallOrder.indexOf(b) ? 1 : 0;
  };

  return {
    compiler: depGraph.getNodeData(compilerName),
    dependants: depGraph.dependantsOf(compilerName).sort(sorting).map(mapping),
    dependencies: depGraph.dependenciesOf(compilerName).sort(sorting).map(mapping),
  };
}

export function getCompilerDebugger(compiler: string | webpack.Compiler) {
  const compilerName = typeof compiler === 'string' ? compiler : compiler.name;

  return debug(`udk:${compilerName}:cpl`);
}

export function holdOnDependencies(compiler: WebpackCompiler2, callback: (err?: Error) => void) {
  const dbg = getCompilerDebugger(compiler);

  const depsRunning = compiler._udk.dependencies.filter(d => d._udk.running);

  depsRunning.forEach((d, index) => {
    dbg('wait for compiler %o', d.name);

    d._udk.callbacks.push(err => {
      dbg('waiting ended for compiler %o', d.name);

      if (err) {
        callback(err);
      } else {
        depsRunning.splice(index, 1);

        if (!depsRunning.length) {
          callback();
        }
      }
    });
  });

  if (!depsRunning.length) {
    callback();
  }
}

export function invalidateDependants(compiler: WebpackCompiler2, callback?: (err?: Error) => void) {
  if (!compiler._udk.lastChange) {
    return;
  }

  const dbg = getCompilerDebugger(compiler);
  const depsNotRunning = compiler._udk.dependants.filter(d => !d._udk.running);
  const lastChange = compiler._udk.lastChange;

  depsNotRunning.forEach(d => {
    if (d._udk.watchings.length) {
      dbg('invalid compiler %o due to change %o', d.name, lastChange);

      wpc.callSync(d, 'invalid', lastChange.fileName, lastChange.changeTime);

      d._udk.watchings.forEach((watching) => {
        if (!(watching as any).closed) { // tslint:disable-line:no-any
          watching.invalidate();
        }
      });
    }
  });
}

export function parseMultiCompilerInput(
  compilers: webpack.Compiler[] | WebpackCompilerMap,
): webpack.Compiler[] {
  if (!compilers || (!Array.isArray(compilers) && typeof compilers !== 'object')) {
    throw new Error('MultiCompiler2 accepts array or object of compilers only');
  }

  if (compilers && !Array.isArray(compilers)) {
    const compilerMap = compilers as WebpackCompilerMap;

    compilers = Object.keys(compilerMap).map(key => {
      const c = compilerMap[key];
      c.name = key;

      return c;
    });
  }

  if (!compilers.length) {
    throw new Error('No compilers was given (array of compilers is empty)');
  }

  const namesDistinct = compilers.filter((c, index, arr) => {
    if (!c.name) {
      throw new Error(`Each compiler must have a name defined: compiler #${index} has none`);
    }

    return arr.find(({ name }) => name === c.name) === c;
  });

  if (namesDistinct.length !== compilers.length) {
    const compilersNames = compilers.map(c => c.name).join(', ');

    throw new Error(`Each config must have an unique name: ${compilersNames}`);
  }

  return compilers;
}

export function prepareCompiler(
  compilerName: string,
  depGraph: DepGraph<WebpackCompiler2>,
): WebpackCompiler2 {
  const {
    compiler,
    dependants,
    dependencies,
  } = getCompiler(compilerName, depGraph);

  if (compiler._udk) {
    throw new Error(`Compiler is already prepared: ${compiler.name}`);
  }

  compiler._udk = {
    compile: compiler.compile.bind(compiler),
    callbacks: [],
    dependants,
    dependencies,
    lastChange: undefined,
    lastError: undefined,
    lastStats: undefined,
    running: false,
    watch: compiler.watch.bind(compiler),
    watchings: [],
  };

  compiler.watch = (watchOptions, handler) => {
    const watching = compiler._udk.watch(watchOptions, handler);

    compiler._udk.watchings.push(watching);

    return watching;
  };

  compiler.compile = callback => holdOnDependencies(compiler, (err?: Error) => {
    if (err) {
      return callback(err);
    }

    const cancelledCompilation = getCancelledCompilation(compiler);

    if (cancelledCompilation) {
      return callback(null, cancelledCompilation);
    }

    compiler._udk.compile(callback);
  });

  for (const stage in WebpackCompilerStage) {
    debugCompilerStage(compiler, stage as WebpackCompilerStage);
  }

  wpc.for('UdkWatchRunPlugin').tap(compiler, 'watchRun', (
    compilerV4OrWatchingv3: webpack.Compiler | webpack.Compiler.Watching,
    done: (err?: Error) => void,
  ) => {
    compiler._udk.running = true;

    done();
  });

  wpc.for('UdkDonePlugin').tap(compiler, 'done', (
    stats: webpack.Stats,
    done: (err?: Error) => void,
  ) => {
    compiler._udk.lastError = null;
    compiler._udk.lastStats = stats;
    compiler._udk.running = false;

    invalidateDependants(compiler);

    compiler._udk.callbacks.forEach(cb => cb());
    compiler._udk.callbacks.length = 0;

    if (done) {
      done();
    }
  });

  wpc.for('UdkFailedPlugin').tap(compiler, 'failed', (err: Error) => {
    compiler._udk.lastError = err;
    compiler._udk.lastStats = null;
    compiler._udk.running = false;

    compiler._udk.callbacks.forEach(cb => cb(err));
    compiler._udk.callbacks.length = 0;
  });

  wpc.for('UdkInvalidPlugin').tap(compiler, 'invalid', (fileName: string, changeTime: number) => {
    compiler._udk.lastChange = { fileName, changeTime };
  });

  return compiler;
}
