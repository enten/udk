// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { ChildProcess } from 'child_process';
import * as path from 'path';

import debug = require('debug');
import exitHook = require('exit-hook');
import Watchpack = require('watchpack');

import {
  ContainerArgs,
  ContainerConfig,
  ContainerRuntime,
  UDKC_PROCESS_TITLE,
  default as Container,
} from '../../../lib/util/container';

jest.mock('child_process', () => ({
  fork: jest.fn(() => ({
    on: jest.fn(),
    once: jest.fn(),
  })),
}));

jest.mock('exit-hook');
jest.mock('watchpack');

afterAll(() => {
  jest.unmock('child_process');

  jest.unmock('exit-hook');
  jest.unmock('watchpack');
});

const ContainerRuntimePath = require.resolve('../../../lib/util/container');

describe('udk/lib/util/container', () => { // tslint:disable-line:no-big-function
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Container', () => {
    it('should be an instance of ContainerRuntime', () => {
      const c = Container({
        argv: [],
        cwd: process.cwd,
      } as {} as NodeJS.Process);

      expect(c).toBeInstanceOf(ContainerRuntime);
    });
  });

  describe('ContainerRuntime', () => { // tslint:disable-line:no-big-function
    describe('static bootstrapFork', () => {
      it('should create and bootstrap', async () => {
        const c = await ContainerRuntime.bootstrapFork({
          argv: [ ContainerRuntimePath ],
          cwd: process.cwd,
          env: {},
          send: () => {},
        } as {} as NodeJS.Process);

        expect(c).toBeInstanceOf(ContainerRuntime);
      });
    });

    describe('constructor', () => {
      it('should enable debug udk:* when debug flag is set', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: process.cwd,
          argv: [ 'node', 'test', '--debug' ],
        } as NodeJS.Process);

        expect(c).toBeTruthy();
        expect(debug.enabled('udk:*')).toBeTruthy();

        c.close = jest.fn();
        (exitHook as jest.Mock).mock.calls[0][0]();

        expect(exitHook).toBeCalled();
        expect(c.close).toBeCalled();
      });

      it('should handle preload modules', () => {
        const preloadPath = require.resolve('../../../package');

        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: process.cwd,
          argv: [ 'node', 'test', '--require', preloadPath, '--require', preloadPath ],
        } as NodeJS.Process);

        expect(c).toBeTruthy();

        expect(() => {
          return new ContainerRuntime(ContainerRuntimePath, {
            cwd: process.cwd,
            argv: [ 'node', 'test', '--require', preloadPath + 'x' ],
          } as NodeJS.Process);
        }).toThrowError('x');
      });
    });

    describe('bootstrap', () => {
      it('should throw when is called in main process', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        c.isChild = false;

        c.bootstrap().then(fail).catch(err =>
          expect(err.message).toEqual('bootstrap() cannot be called in main process'));
      });

      it('should set process title', async () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        c.isChild = true;
        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        // tslint:disable-next-line:no-any
        c.loadConfig = () => ({ config: { processTitle: 'foo' } }) as any;

        await c.bootstrap();

        expect(c.proc.title).toEqual('foo');

        // tslint:disable-next-line:no-any
        c.loadConfig = () => ({ configPath: 'fake', config: {} }) as any;

        await c.bootstrap();

        expect(c.proc.title).toEqual(UDKC_PROCESS_TITLE);
      });

      it('should call config.bootstrap if exists', async () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        c.isChild = true;
        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        const bootstrap = jest.fn();

        // tslint:disable-next-line:no-any
        c.loadConfig = () => ({ config: { bootstrap } }) as any;

        await c.bootstrap();

        expect(bootstrap).toBeCalled();
      });

      it('should call shutDown on exit', async () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        c.isChild = true;
        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        // tslint:disable-next-line:no-any
        c.loadConfig = () => ({ config: {} }) as any;

        await c.bootstrap();

        expect(exitHook).toBeCalled();
        expect((exitHook as jest.Mock).mock.calls.length).toEqual(2);
        expect(typeof (exitHook as jest.Mock).mock.calls[1][0]).toEqual('function');

        const shutDown = jest.fn();

        c.onShutDown = shutDown;

        (exitHook as jest.Mock).mock.calls[1][0]();

        expect(shutDown).toBeCalled();
      });
    });

    describe('close', () => {
      it('should send close action to parent in child process', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        c.isChild = true;

        c.close();

        c.proc.send = jest.fn();

        c.close();

        expect(c.proc.send).toBeCalledWith({ action: 'close' });
      });

      it('should close watcher', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        const closeWatcher = jest.fn();
        c.watcher = { close: closeWatcher } as any; // tslint:disable-line:no-any
        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        c.close();

        expect(c.watcher).toBeUndefined();
        expect(closeWatcher).toBeCalled();
      });

      it('should close child', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        c.child =  { pid: NaN } as ChildProcess;
        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        c.close();

        expect(c.child).toBeUndefined();
      });

      it('should handle callback', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        const callback = jest.fn();

        (c as any).debug = jest.fn(); // tslint:disable-line:no-any
        c.close(callback);

        expect(callback).toBeCalled();
      });
    });

    describe('run', () => {
      it('should send run action to parent in child process', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        c.isChild = true;

        c.run();

        c.proc.send = jest.fn();

        c.run();

        expect(c.proc.send).toBeCalledWith({ action: 'run' });
      });

      it('should parent process listen to child process messages', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => path.resolve(__dirname, '..', '..', 'e2e'),
          argv: [],
        } as {} as NodeJS.Process);

        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        c.run();

        expect(c.child).toBeDefined();

        const childOn = (c.child as {} as ChildProcess).on as jest.Mock;

        expect(childOn).toBeCalled();
        expect(childOn.mock.calls[0][0]).toBe('message');

        const onMessage = childOn.mock.calls[0][1];

        expect(typeof onMessage).toBe('function');

        c.close = jest.fn();
        c.run = jest.fn();

        onMessage({ action: 'close' });
        onMessage({ action: 'run' });
        onMessage({ action: 'unknown' });

        expect(c.close).toBeCalled();
        expect(c.run).toBeCalled();
      });

      it('should create watcher and child', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => path.resolve(__dirname, '..', '..', 'e2e'),
          argv: [],
        } as {} as NodeJS.Process);

        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        c.run();

        expect(c.child).toBeDefined();
        expect(c.watcher as Watchpack).toBeDefined();
        expect(((c.watcher as Watchpack).watch as jest.Mock)).toBeCalled();
      });

      it('should remove child reference when exit or error', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => path.resolve(__dirname, '..', '..', 'e2e'),
          argv: [],
        } as {} as NodeJS.Process);

        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        c.run();

        expect(c.child).toBeDefined();

        if (c.child) {
          const childOnce = c.child.once as jest.Mock;

          expect(childOnce).toBeCalled();

          c.child = {} as ChildProcess;

          expect(childOnce.mock.calls[0][0]).toEqual('exit');
          expect(typeof childOnce.mock.calls[0][1]).toEqual('function');
          expect(() => childOnce.mock.calls[0][1]()).not.toThrowError();
          expect(c.child).toBeUndefined();

          c.child = {} as ChildProcess;

          expect(childOnce.mock.calls[1][0]).toEqual('error');
          expect(typeof childOnce.mock.calls[1][1]).toEqual('function');
          expect(() => childOnce.mock.calls[1][1]( new Error('fake error'))).toThrow('fake error');
          expect(c.child).toBeUndefined();
        }
      });

      it('should re-run when metafile change', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => __dirname,
          argv: [],
        } as {} as NodeJS.Process);

        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        c.run();

        const watcher = c.watcher as Watchpack;
        let watchOnce = watcher.once as jest.Mock;

        expect(watchOnce).toBeCalled();
        expect(watchOnce.mock.calls.length).toEqual(1);
        expect(watchOnce.mock.calls[0][0]).toEqual('aggregated');
        expect(typeof watchOnce.mock.calls[0][1]).toEqual('function');

        const change = watchOnce.mock.calls[0][1];

        const watch = jest.fn();
        const watchPause = jest.fn();
        watchOnce = jest.fn();

        c.watcher = {
          options: {},
          watcherOptions: {},
          pause: watchPause,
          watch,
          once: watchOnce,
        } as any; // tslint:disable-line:no-any

        c.loadConfig = () => ({
          config: {
            context: '/',
            metafiles: [ 'foo' ],
            metadirs: [ 'bar' ],
            watchOptions: { ignored: true, poll: true },
          },
        }) as any; // tslint:disable-line:no-any

        change.call(c);

        expect(watch).toBeCalled();
        expect(watch.mock.calls[0][0]).toEqual([ path.resolve('/foo') ]);
        expect(watch.mock.calls[0][1]).toEqual([ path.resolve('/bar') ]);
        expect(watchOnce).toBeCalled();
        expect(watchPause).toBeCalled();
        expect(watchOnce).toBeCalled();
        expect(watchPause).toBeCalled();
      });

      it('should handle callback', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => __dirname,
          argv: [],
        } as {} as NodeJS.Process);

        (c as any).debug = jest.fn(); // tslint:disable-line:no-any

        let callback = jest.fn();

        c.run(callback);

        expect(callback).toBeCalled();

        callback = jest.fn();

        c.run(callback);

        expect(callback).toBeCalled();
      });
    });

    describe('loadConfig', () => {
      it('should load config given in cli', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        const cwd = path.resolve(__dirname, '..', '..', 'e2e');
        const configPath = path.resolve(cwd, 'udk.container.ts');

        expect(c.loadConfig({
          cwd,
          config: 'udk.container',
        } as ContainerArgs).configPath).toEqual(configPath);
      });

      it('should try to load default config name from cwd', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        const cwd = path.resolve(__dirname, '..', '..', 'e2e');
        const configPath = path.resolve(cwd, 'udk.container.ts');

        const loading = c.loadConfig({ cwd } as ContainerArgs);

        expect(loading.configPath).toEqual(configPath);
        expect(loading.config.context).toEqual(cwd);
      });

      it('should return config with context only when there is no config file', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        const loading = c.loadConfig({ cwd: __dirname } as ContainerArgs);

        expect(loading.configPath).toBeUndefined();
        expect(loading.config).toEqual({ context: __dirname });
      });
    });

    describe('parseProcessArgsOptions', () => {
      it('should return yargs options', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        expect(c.parseProcessArgsOptions()).toEqual({
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
            cwd: '',
            debug: false,
            require: [],
          },
          string: [ 'config', 'cwd', 'require' ],
        });
      });
    });

    describe('prepareConfig', () => {
      it('should define config.logger if not exists', async () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        const config = {} as ContainerConfig;

        await c.prepareConfig(config);

        expect(config.logger).toBe(c.logger);

        c.logger = {} as Console;

        await c.prepareConfig(config);

        expect(config.logger).not.toBe(c.logger);
      });
    });

    describe('shutDown', () => {
      it('should call config.onDown if exists', () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        const config = {} as ContainerConfig;
        const onDown = jest.fn();

        c.onShutDown(config);

        expect(onDown).not.toBeCalled();

        config.onDown = onDown;

        c.onShutDown(config);

        expect(onDown).toBeCalledWith(c);
      });
    });

    describe('shutUp', () => {
      it('should call config.onUp if exists', async () => {
        const c = new ContainerRuntime(ContainerRuntimePath, {
          cwd: () => '',
          argv: [],
        } as {} as NodeJS.Process);

        const config = {} as ContainerConfig;
        const onUp = jest.fn();

        await c.onShutUp(config);

        expect(onUp).not.toBeCalled();

        config.onUp = onUp;

        await c.onShutUp(config);

        expect(onUp).toBeCalledWith(c);
      });
    });
  });
});
