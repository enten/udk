// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

/// <reference path="../../types/yargs-parser/index.d.ts" />

import { ChildProcess, fork } from 'child_process';
import * as path from 'path';

import debug = require('debug');
import exitHook = require('exit-hook');
import killer = require('killer');
import resolve = require('resolve');
import Watchpack = require('watchpack');
import yargs = require('yargs-parser');

import { existsModule } from './existsModule';
import { requireModule } from './requireModule';

export interface ContainerAPI {
  readonly args: ContainerArgs;
  readonly debug: debug.IDebugger;
  readonly isChild: boolean;
  readonly logger: Console;
  readonly runtimePath: string;
  readonly proc: NodeJS.Process;
  bootstrap(): Promise<ContainerAPI>;
  close(callback?: () => void): void;
  run(callback?: () => void): void;
}

export interface ContainerArgs extends yargs.ArgsParsed {
  config?: string;
  cwd: string;
  debug: boolean;
  require: string[];
}

export interface ContainerConfig {
  context?: string;
  logger: Console;
  metafiles?: string[];
  metadirs?: string[];
  processTitle?: string;
  watchOptions?: Watchpack.WatchOptions;
  bootstrap?(runtime: ContainerRuntime): void | Promise<void>;
  onUp?(runtime: ContainerRuntime): void | Promise<void>;
  onDown?(runtime: ContainerRuntime): void;
}

export interface ContainerFactory {
  (proc: NodeJS.Process): ContainerAPI;
}

export const UDKC_CONFIG_NAMES = [
  'udk.config',
  'udk.container',
  'udkfile',
];

export const UDKC_PROCESS_TITLE = 'udk-ctnr';

export class ContainerRuntime implements ContainerAPI {
  static create(runtimePath: string, proc: NodeJS.Process): ContainerAPI {
    return new this(runtimePath, proc);
  }

  static export(mod: NodeJS.Module): ContainerFactory {
    return (proc: NodeJS.Process) => this.create(mod.filename, proc);
  }

  static bootstrapFork(proc: NodeJS.Process) {
    const runtimePath = proc.argv.pop() as string;
    const Runtime = requireModule<ContainerFactory>(runtimePath, { cache: false });

    return Runtime(proc).bootstrap();
  }

  args: ContainerArgs;
  child?: ChildProcess;
  debug = debug(this.debugNs);
  isChild = !!this.proc.send;
  logger = console;
  preloadPaths: string[] = [];
  requirePath?: string;
  watcher?: Watchpack;

  get debugNs() {
    return `udk:ctnr${this.proc.send ? ':fork' : ''}`;
  }

  constructor(readonly runtimePath: string, readonly proc: NodeJS.Process) {
    this.args = this.parseProcessArgs();

    if (this.args.debug) {
      debug.enable('udk:*');
    }

    this.args.require.forEach(preloadPath => this.preloadModule(preloadPath));

    if (!this.isChild) {

      exitHook(() => this.close());

      // Press "Enter" to reload container
      // this.proc.stdin.on('data', () => this.run());
    }
  }

  async bootstrap() {
    if (!this.isChild) {
      throw new Error('bootstrap() cannot be called in main process');
    }

    this.debug('[%o] bootstrap container', this.proc.pid);
    this.debug('runtimePath: %o', this.runtimePath);
    this.debug('args: %o', this.args);

    const { config, configPath } = this.loadConfig(this.args);

    if (configPath) {
      this.debug('[%o] load config file %o', this.proc.pid, configPath);
    }

    // this.config = config;
    // this.configPath = configPath;

    this.proc.title = config.processTitle || UDKC_PROCESS_TITLE;

    if (config.bootstrap) {
      await config.bootstrap(this);
    }

    await this.prepareConfig(config);

    this.debug('[%o] container up', this.proc.pid);

    await this.shutUp(config);

    exitHook(() => {
      this.debug('[%o] container down', this.proc.pid);

      this.shutDown(config);
    });

    return this;
  }

  close(callback?: () => void) {
    if (this.isChild) {
      throw new Error('close() cannot be called in child process');
    }

    this.debug('[%o] close container', this.proc.pid);

    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    if (this.child) {
      return killer(this.child, () => {
        this.child = undefined;
        this.close(callback);
      });
    }

    if (callback) {
      callback();
    }
  }

  run(callback?: () => void) {
    if (this.isChild) {
      throw new Error('run() cannot be called in child process');
    }

    this.debug('[%o] run container', this.proc.pid);
    this.debug('runtimePath: %o', this.runtimePath);
    this.debug('args: %o', this.args);

    // pause watcher if exists
    if (this.watcher && !this.watcher.paused) {
      this.watcher.pause();
    }

    // kill child if exists
    if (this.child) {
      this.debug('[%o] kill child before restart', this.proc.pid);

      return killer(this.child, () => {
        this.debug('[%o] child killed', this.proc.pid);

        this.child = undefined;
        this.run(callback);
      });
    }

    // resolve config file if exists (and require/reload it)
    const { config, configPath } = this.loadConfig(this.args);

    if (configPath) {
      this.debug('[%o] load config file %o', this.proc.pid, configPath);
    }

    // create watcher or mutate options of the eixsts one
    if (!this.watcher) {
      this.watcher = new Watchpack(config.watchOptions || {});
    } else if (this.watcher && config.watchOptions) {
      Object.assign(this.watcher.options, config.watchOptions);
      Object.assign(this.watcher.watcherOptions, {
        ignored: config.watchOptions.ignored,
        poll: config.watchOptions.poll,
      });
    }

    const forkModulePath = __filename;
    const forkArgv = this.proc.argv.slice(2).concat(this.runtimePath);
    // const forkOptions: ForkOptions = { cwd: this.args.cwd };

    this.debug('[%o] fork child process', this.proc.pid);
    this.debug('modulePath: %o', forkModulePath);
    this.debug('argv: %o', forkArgv);
    // this.debug('options: %o', forkOptions);

    // fork child process
    this.child = fork(forkModulePath, forkArgv); // , forkOptions);

    this.child.once('exit', code => {
      const childPid = this.child && this.child.pid;
      this.debug('[%o] child %o exit with code %o', this.proc.pid, childPid, code);
      this.child = undefined;
    });

    this.child.once('error', err => {
      this.child = undefined;

      throw err;
    });

    // prepare metafiles watching
    const resolvePaths = (paths: string[]) =>
      paths.map(p => path.resolve(config.context as string, p));
    const metadirs = resolvePaths(([] as string[]).concat(config.metadirs || []));
    const metafiles = resolvePaths(([] as string[]).concat(config.metafiles || []));

    this.debug('[%o] watch on meta files and directories', this.proc.pid);
    this.debug('metadirs: %O', metadirs);
    this.debug('metafiles: %O', metafiles);

    // watch metafiles
    this.watcher.watch(metafiles, metadirs, Date.now());

    // reload container when metafile changed
    this.watcher.once('aggregated', (changes) => {
      this.debug('[%o] watcher changes aggregated', this.proc.pid);
      this.debug('changes: %o', changes);

      this.run();
    });

    // finally callback if given
    if (callback) {
      callback();
    }
  }

  loadConfig(args: ContainerArgs): { config: ContainerConfig, configPath?: string } {
    let configPath = args.config;
    let config = { context: args.cwd } as ContainerConfig;

    if (configPath) {
      configPath = require.resolve(path.resolve(args.cwd, configPath));
    } else {
      for (const configFileName of UDKC_CONFIG_NAMES) {
        configPath = existsModule(path.resolve(args.cwd, configFileName));

        if (configPath) {
          break;
        }
      }
    }

    if (configPath) {
      config = requireModule<ContainerConfig>(configPath, { cache: false });

      if (!config.context) {
        config.context = path.dirname(configPath);
      }
    }

    return { config, configPath };
  }

  parseProcessArgs(): ContainerArgs {
    return yargs(this.proc.argv.slice(2), this.parseProcessArgsOptions()) as ContainerArgs;
  }

  parseProcessArgsOptions(): yargs.Options {
    return {
      alias: {
        config: 'c',
        cwd: 'C',
        debug: 'D',
        require: 'r',
      },
      array: [ 'require' ],
      boolean: [ 'debug' ],
      envPrefix: 'UDK',
      default: {
        cwd: this.proc.cwd(),
        debug: false,
        require: [],
      },
      string: [ 'config', 'cwd', 'require' ],
    };
  }

  preloadModule(preloadPath: string) {
    preloadPath = resolve.sync(preloadPath, { basedir: this.args.cwd });

    if (this.preloadPaths.indexOf(preloadPath) === -1) {
      require(preloadPath);

      this.preloadPaths.push(preloadPath);
    }
  }

  async prepareConfig(config: ContainerConfig) {
    if (!config.logger) {
      config.logger = this.logger;
    }
  }

  shutDown(config: ContainerConfig) {
    if (config && config.onDown) {
      config.onDown(this);
    }
  }

  async shutUp(config: ContainerConfig) {
    if (config && config.onUp) {
      config.onUp(this);
    }
  }
}

export default ContainerRuntime.export(module);

/* istanbul ignore next */
if (process.mainModule === module && process.send) {
  ContainerRuntime.bootstrapFork(process)
    // .then(container => {
    //   container.debug('[%o] exit', container.proc.pid);
    //   process.exit(0);
    // })
    .catch(err => {
      console.error(err);
      process.exit(99);
    });
}
