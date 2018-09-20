// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { DepGraph } from 'dependency-graph';
import * as webpack from 'webpack';
import wpc = require('webpack-plugin-compat');

import {
  MultiCompiler1,
  WebpackCompiler2,
  WebpackCompilerStage,
  createDepGraph,
  debugCompilerStage,
  default as MultiCompiler,
  getCancelledCompilation,
  getCompiler,
  getCompilerDebugger,
  holdOnDependencies,
  invalidateDependants,
  parseMultiCompilerInput,
  prepareCompiler,
} from '../../lib/MultiCompiler';

jest.mock('webpack-plugin-compat', () => ({
  for: jest.fn((pluginName: string) => ({
    tap: jest.fn(),
  })),
  callSync: jest.fn(),
}));

afterAll(() => {
  jest.unmock('webpack-plugin-compat');
});

describe('udk/lib/MultiCompiler', () => { // tslint:disable-line:no-big-function
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('MultiCompiler', () => {
    it('should prepare given compilers', () => {
      const compiler = {
        name: 'foo',
        dependencies: [ 'bar' ],
        hooks: {
          done: { tap: jest.fn() },
          invalid: { tap: jest.fn() },
        },
        compile: jest.fn(),
        watch: jest.fn(),
      } as {} as webpack.Compiler;
      const compiler2 = {
        name: 'bar',
        hooks: {
          done: { tap: jest.fn() },
          invalid: { tap: jest.fn() },
        },
        compile: jest.fn(),
        watch: jest.fn(),
      } as {} as webpack.Compiler;

      const multiCompiler = new MultiCompiler([ compiler, compiler2 ]);

      expect(multiCompiler).toBeInstanceOf(MultiCompiler1);
      expect(multiCompiler._udk).toBeTruthy();
      expect(multiCompiler._udk.overallOrder).toEqual([ 'bar', 'foo' ]);

      expect(multiCompiler.getCompiler('foo'))
        .toEqual(getCompiler('foo', multiCompiler._udk.depGraph));

      expect(multiCompiler.getCompiler('bar'))
        .toEqual(getCompiler('bar', multiCompiler._udk.depGraph));
    });
  });

  describe('createDepGraph', () => {
    it('should return graph dependencies', () => {
      const depGraph = createDepGraph([
        { name: 'foo' },
        { name: 'bar', dependencies: [ 'foo' ] },
        { name: 'baz', dependencies: [ 'bar' ] },
        { name: 'bax', dependencies: [ 'bar' ] },
        { name: 'bam', dependencies: [ 'bar' ] },
      ] as WebpackCompiler2[]);

      expect(depGraph.overallOrder()).toEqual([
        'foo',
        'bar',
        'baz',
        'bax',
        'bam',
      ]);
    });
  });

  describe('debugCompilerStage', () => {
    it('should tap stage to debug (by careful with async stages)', () => {
      const compiler = { name: 'foo' } as WebpackCompiler2;

      debugCompilerStage(compiler, WebpackCompilerStage.invalid);

      expect(wpc.for).toBeCalledWith('UdkDebugStagePlugin');

      const tapMock = (wpc.for as jest.Mock).mock.results[0].value.tap as jest.Mock;

      expect(tapMock).toBeCalledTimes(1);
      expect(tapMock.mock.calls[0][0]).toBe(compiler);
      expect(tapMock.mock.calls[0][1]).toBe(WebpackCompilerStage.invalid);
      expect(typeof tapMock.mock.calls[0][2]).toEqual('function');

      const cb = jest.fn();

      tapMock.mock.calls[0][2]('fileName', 123);

      expect(cb).not.toBeCalled();

      tapMock.mock.calls[0][2]('fileName', 123, cb);

      expect(cb).toBeCalled();
    });
  });

  describe('getCancelledCompilation', () => {
    it('should return undefined when there are no dependencies', () => {
      const compiler = {
        _udk: {
          dependencies: [] as WebpackCompiler2[],
        },
      } as WebpackCompiler2;

      expect(getCancelledCompilation(compiler)).toEqual(undefined);
    });

    it('should return undefined when there are no cancelled compilations', () => {
      const compiler = {
        _udk: {
          dependencies: [
            { _udk: { lastStats: { hasErrors: () => false } } },
            { _udk: { lastError: null } },
          ] as WebpackCompiler2[],
        },
      } as WebpackCompiler2;

      expect(getCancelledCompilation(compiler)).toEqual(undefined);
    });

    it('should return cancelled compilation (webpack v4)', () => {
      let createHashCalled = false;
      let inputFsPurgeCalled = false;

      const compiler = {
        createCompilation: () => ({
          errors: [],
          createHash: () => { createHashCalled = true; },
          inputFileSystem: { purge: () => { inputFsPurgeCalled = true; } },
        } as Partial<webpack.compilation.Compilation>),
        hooks: {} as Partial<webpack.compilation.CompilationHooks>,
        _udk: {
          dependencies: [
            {
              name: 'foo',
              _udk: {
                lastStats: { hasErrors: () => true },
              } as Partial<WebpackCompiler2['_udk']> },
            {
              name: 'bar',
              _udk: {
                lastError: new Error('fake error'),
              } as Partial<WebpackCompiler2['_udk']>,
            },
          ] as WebpackCompiler2[],
        },
      } as WebpackCompiler2;

      const cancelledCompilation = getCancelledCompilation(compiler);
      expect(cancelledCompilation).toBeTruthy();

      if (cancelledCompilation) {
        const compilationV4 = cancelledCompilation as any; // tslint:disable-line:no-any

        expect(createHashCalled).toBeTruthy();
        expect(inputFsPurgeCalled).toBeTruthy();

        expect(compilationV4.errors.length).toEqual(1);
        expect(compilationV4.errors[0].message).toEqual(
          '[udk] MultiCompiler\n'
          + 'Compilation cancelled due to errors in previous compilers: foo, bar',
        );

        expect(compilationV4.fileDependencies instanceof Set).toBeTruthy();
        expect(compilationV4.contextDependencies instanceof Set).toBeTruthy();
        expect(compilationV4.missingDependencies instanceof Set).toBeTruthy();
      }
    });

    it('should return cancelled compilation (webpack v3)', () => {
      let createHashCalled = false;
      let inputFsPurgeCalled = false;

      const compiler = {
        createCompilation: () => ({
          errors: [],
          createHash: () => { createHashCalled = true; },
          inputFileSystem: { purge: () => { inputFsPurgeCalled = true; } },
        } as Partial<webpack.compilation.Compilation>),
        _udk: {
          dependencies: [
            {
              name: 'foo',
              _udk: {
                lastStats: { hasErrors: () => true },
              } as Partial<WebpackCompiler2['_udk']> },
            {
              name: 'bar',
              _udk: {
                lastError: new Error('fake error'),
              } as Partial<WebpackCompiler2['_udk']>,
            },
          ] as WebpackCompiler2[],
        },
      } as WebpackCompiler2;

      const cancelledCompilation = getCancelledCompilation(compiler);
      expect(cancelledCompilation).toBeTruthy();

      if (cancelledCompilation) {
        const compilationV3 = cancelledCompilation as any; // tslint:disable-line:no-any

        expect(createHashCalled).toBeTruthy();
        expect(inputFsPurgeCalled).toBeTruthy();

        expect(compilationV3.errors.length).toEqual(1);
        expect(compilationV3.errors[0].message).toEqual(
          '[udk] MultiCompiler\n'
          + 'Compilation cancelled due to errors in previous compilers: foo, bar',
        );

        expect(compilationV3.fileDependencies instanceof Array).toBeTruthy();
        expect(compilationV3.contextDependencies instanceof Array).toBeTruthy();
        expect(compilationV3.missingDependencies instanceof Array).toBeTruthy();
      }
    });
  });

  describe('getCompiler', () => {
    it('should return compiler with dependants and dependencies', () => {
      const foo = {} as WebpackCompiler2;
      const bar = {} as WebpackCompiler2;
      const baz = {} as WebpackCompiler2;
      const bax = {} as WebpackCompiler2;
      const bam = {} as WebpackCompiler2;
      const depGraph = new DepGraph<WebpackCompiler2>({ });
      depGraph.addNode('foo', foo);
      depGraph.addNode('bar', bar);
      depGraph.addNode('bax', bax);
      depGraph.addNode('baz', baz);
      depGraph.addNode('bam', bam);
      depGraph.addDependency('bar', 'foo');
      depGraph.addDependency('baz', 'bar');
      depGraph.addDependency('bax', 'bar');
      depGraph.addDependency('bam', 'bar');

      const {
        compiler,
        dependants,
        dependencies,
      } = getCompiler('bar', depGraph);

      expect(compiler).toBe(bar);
      expect(Array.isArray(dependants)).toBeTruthy();
      expect(dependants.length).toEqual(3);
      expect(Array.isArray(dependencies)).toBeTruthy();
      expect(dependencies.length).toEqual(1);
    });
  });

  describe('getCompilerDebugger', () => {
    it('should return debugger with given compiler name', () => {
      const dbug = getCompilerDebugger({ name: 'foo' } as webpack.Compiler);

      expect(dbug.namespace).toEqual('udk:foo:cpl');
    });

    it('should return debugger with given name', () => {
      const dbug = getCompilerDebugger('bar');

      expect(dbug.namespace).toEqual('udk:bar:cpl');
    });
  });

  describe('holdOnDependencies', () => {
    it('should not wait for compiler dependencies when there is no one', () => {
      const compiler = {
        name: 'foo',
        _udk: {
          dependencies: [] as WebpackCompiler2[],
        },
      } as WebpackCompiler2;

      let end = false;

      holdOnDependencies(compiler, () => {
        end = true;
      });

      expect(end).toBeTruthy();
    });

    it('should wait for compiler dependencies', () => {
      const compiler = {
        name: 'foo',
        _udk: {
          dependencies: [
            { _udk: { running: false, callbacks: [] } as Partial<WebpackCompiler2['_udk']> },
            { _udk: { running: true, callbacks: [] } as Partial<WebpackCompiler2['_udk']> },
            { _udk: { running: true, callbacks: [] } as Partial<WebpackCompiler2['_udk']> },
          ] as WebpackCompiler2[],
        },
      } as WebpackCompiler2;

      let error: Error | undefined;
      let end = false;

      holdOnDependencies(compiler, err => {
        error = err;
        end = true;
      });

      expect(compiler._udk.dependencies[0]._udk.callbacks.length).toEqual(0);
      expect(compiler._udk.dependencies[1]._udk.callbacks.length).toEqual(1);
      expect(compiler._udk.dependencies[2]._udk.callbacks.length).toEqual(1);
      expect(end).toBeFalsy();

      compiler._udk.dependencies[2]._udk.callbacks[0]();

      expect(end).toBeFalsy();

      compiler._udk.dependencies[1]._udk.callbacks[0]();

      expect(end).toBeTruthy();
      expect(error).toBeFalsy();
      expect(compiler._udk.dependencies[0]._udk.callbacks.length).toEqual(0);
      expect(compiler._udk.dependencies[1]._udk.callbacks.length).toEqual(1);
      expect(compiler._udk.dependencies[2]._udk.callbacks.length).toEqual(1);
    });

    it('should interupt waiting when error is thrown', () => {
      const compiler = {
        name: 'foo',
        _udk: {
          dependencies: [
            { _udk: { running: false, callbacks: [] } as Partial<WebpackCompiler2['_udk']> },
            { _udk: { running: true, callbacks: [] } as Partial<WebpackCompiler2['_udk']> },
            { _udk: { running: true, callbacks: [] } as Partial<WebpackCompiler2['_udk']> },
          ] as WebpackCompiler2[],
        },
      } as WebpackCompiler2;

      const fakeError = new Error('fake error');
      let error: Error | undefined;
      let end = false;

      holdOnDependencies(compiler, err => {
        error = err;
        end = true;
      });

      expect(compiler._udk.dependencies[0]._udk.callbacks.length).toEqual(0);
      expect(compiler._udk.dependencies[1]._udk.callbacks.length).toEqual(1);
      expect(compiler._udk.dependencies[2]._udk.callbacks.length).toEqual(1);
      expect(end).toBeFalsy();

      compiler._udk.dependencies[2]._udk.callbacks[0](fakeError);

      expect(end).toBeTruthy();
      expect(error).toBe(fakeError);
      expect(compiler._udk.dependencies[0]._udk.callbacks.length).toEqual(0);
      expect(compiler._udk.dependencies[1]._udk.callbacks.length).toEqual(1);
      expect(compiler._udk.dependencies[2]._udk.callbacks.length).toEqual(1);
    });
  });

  describe('invalidateDependants', () => {
    it('should invalidate watchings when there is lastChange only', () => {
      let invalidateCount = 0;

      const compiler = {
        _udk: {
          lastChange: null,
          dependants: [
            { _udk: {
              watchings: [
                { invalidate: () => { ++invalidateCount; } },
              ],
            } },
          ],
        },
      } as {} as WebpackCompiler2;

      invalidateDependants(compiler);

      expect(invalidateCount).toEqual(0);
    });

    it('should invalidate watchings of each not running dependants', () => {
      let invalidateCount = 0;

      const compiler = {
        _udk: {
          lastChange: {
            fileName: 'foo',
            changeTime: 123,
          },
          dependants: [
            { _udk: {
              running: true,
              watchings: [
                { invalidate: () => { ++invalidateCount; } },
                { invalidate: () => { ++invalidateCount; } },
              ],
            } },
            { _udk: {
              running: false,
              watchings: [],
            } },
            { _udk: {
              running: false,
              watchings: [
                { closed: true, invalidate: () => { ++invalidateCount; } },
                { invalidate: () => { ++invalidateCount; } },
              ],
            } },
          ],
        },
      } as {} as WebpackCompiler2;

      invalidateDependants(compiler);

      expect(invalidateCount).toEqual(1);
    });

    it('should call invalid stage when there is a last change', () => {
      const compiler = {
        _udk: {
          dependants: [
            {
              _udk: {
                running: false,
                watchings: [ { invalidate: () => {} } ] as webpack.Compiler.Watching[],
              },
            },
          ],
          lastChange: {
            fileName: 'fake.ts',
            changeTime: 123,
          },
        },
      } as WebpackCompiler2;

      invalidateDependants(compiler);

      expect(wpc.callSync).toBeCalledWith(
        compiler._udk.dependants[0],
        'invalid',
        'fake.ts',
        123,
      );
    });
  });

  describe('parseMultiCompilerInput', () => {
    it('should throw error when given not object or array', () => {
      expect(() => parseMultiCompilerInput(null as any)) // tslint:disable-line: no-any
       .toThrowError('MultiCompiler2 accepts array or object of compilers only');
    });

    it('should throw error when given empty object or array', () => {
      expect(() => parseMultiCompilerInput({ }))
       .toThrowError('No compilers was given (array of compilers is empty)');

      expect(() => parseMultiCompilerInput([ ]))
       .toThrowError('No compilers was given (array of compilers is empty)');
    });

    it('should throw error when a compiler has not a name', () => {
      expect(() => parseMultiCompilerInput([
        { name: 'foo' } as WebpackCompiler2,
        {} as WebpackCompiler2,
      ])).toThrowError('Each compiler must have a name defined: compiler #1 has none');
    });

    it('should throw error when given compilers with same name', () => {
      expect(() => parseMultiCompilerInput([
        { name: 'foo' } as WebpackCompiler2,
        { name: 'bar' } as WebpackCompiler2,
        { name: 'foo' } as WebpackCompiler2,
      ])).toThrowError('Each config must have an unique name: foo, bar, foo');
    });

    it('should return compilers array', () => {
      expect(parseMultiCompilerInput({
        foo: {} as WebpackCompiler2,
        bar: {} as WebpackCompiler2,
      })).toEqual([ { name: 'foo' }, { name: 'bar' } ]);
    });
  });

  describe('prepareCompiler', () => { // tslint:disable-line:no-big-function
    it('should throw when compiler is already prepared', () => {
      const depGraph = createDepGraph([
        { name: 'foo', _udk: {} } as WebpackCompiler2,
      ] as WebpackCompiler2[]);

      expect(() => prepareCompiler('foo', depGraph))
        .toThrowError('Compiler is already prepared: foo');
    });

    it('should mutate compiler compile() and watch()', () => {
      const fakeError = new Error('fake error');
      const callback = jest.fn();
      const compile = jest.fn((cb: () => {}) => cb());
      const watching = {};
      const watch = jest.fn(() => watching);
      const watchOptions = {};
      const watchHandler = () => {};
      const compiler = {
        name: 'foo',
        dependencies: [ 'bar' ],
        compile,
        watch,
        _udk: undefined,
        createCompilation: () => ({
          errors: [],
          createHash: () => {},
          inputFileSystem: {
            purge: () => {},
          },
        }),
      } as {} as WebpackCompiler2;
      const compiler2 = {
        name: 'bar',
        _udk: { callbacks: [] },
      } as {} as WebpackCompiler2;
      const depGraph = createDepGraph([ compiler, compiler2 ]);

      expect(() => prepareCompiler('foo', depGraph)).not.toThrowError();

      const _udk = compiler._udk as any as WebpackCompiler2['_udk']; // tslint:disable-line:no-any

      expect(_udk).toBeTruthy();
      expect(_udk.watchings.length).toEqual(0);

      expect(compiler.compile).not.toBe(compile);
      expect(compiler.watch).not.toBe(watch);

      expect(compiler.watch(watchOptions, watchHandler)).toBe(watching);
      expect(_udk.watchings.length).toEqual(1);
      expect(watch).toBeCalledWith(watchOptions, watchHandler);

      callback.mockClear();

      compiler.compile(callback);

      expect(callback).toBeCalledWith();

      callback.mockClear();

      compiler2._udk.running = true;
      compiler.compile(callback);

      expect(callback).not.toBeCalled();
      expect(compiler2._udk.callbacks.length).toEqual(1);

      callback.mockClear();

      compiler2._udk.callbacks[0](fakeError);

      expect(callback).toBeCalledWith(fakeError);
      expect(compiler2._udk.callbacks.length).toEqual(1);

      callback.mockClear();

      compiler2._udk.lastStats = {
        hasErrors: () => true,
      };

      compiler2._udk.callbacks[0]();

      expect(callback.mock.calls.length).toEqual(1);
      expect(callback.mock.calls[0][0]).toBeNull();
      expect(callback.mock.calls[0][1]).toBeDefined();
      expect(callback.mock.calls[0][1].name).toEqual('foo');
      expect(callback.mock.calls[0][1].errors.length).toEqual(1);
      expect(callback.mock.calls[0][1].errors[0].message).toEqual(
        '[udk] MultiCompiler\n'
        + 'Compilation cancelled due to errors in previous compilers: bar',
      );
    });

    it('should tap udk plugins', () => {
      const wpcFor = wpc.for as jest.Mock;

      const fakeError = new Error('fake error');
      const watching = {};
      const invalidate = jest.fn();
      const compiler = {
        name: 'foo',
        compile: jest.fn(),
        watch: jest.fn(() => watching),
        _udk: undefined,
      } as {} as WebpackCompiler2;
      const compiler2 = {
        name: 'bar',
        dependencies: [ 'foo' ],
        _udk: { callbacks: [], watchings: [ { invalidate } ] },
      } as {} as WebpackCompiler2;
      const depGraph = createDepGraph([ compiler, compiler2 ]);

      expect(() => prepareCompiler('foo', depGraph)).not.toThrowError();

      expect(wpcFor.mock.calls.length).toEqual(Object.keys(WebpackCompilerStage).length + 4);

      for (const stage in WebpackCompilerStage) {
        const call = wpcFor.mock.calls.shift() as any[]; // tslint:disable-line:no-any
        const tap = (wpcFor.mock.results.shift() as { value: { tap: jest.Mock } }).value.tap;

        expect(call[0]).toEqual('UdkDebugStagePlugin');
        expect(tap.mock.calls.length).toEqual(1);
        expect(tap.mock.calls[0][0]).toEqual(compiler);
        expect(tap.mock.calls[0][1]).toEqual(stage);
      }

      let call = wpcFor.mock.calls.shift() as any[]; // tslint:disable-line:no-any
      let tap = (wpcFor.mock.results.shift() as { value: { tap: jest.Mock } }).value.tap;

      expect(call[0]).toEqual('UdkWatchRunPlugin');
      expect(tap.mock.calls.length).toEqual(1);
      expect(tap.mock.calls[0][0]).toEqual(compiler);
      expect(tap.mock.calls[0][1]).toEqual(WebpackCompilerStage.watchRun);
      expect(typeof tap.mock.calls[0][2]).toEqual('function');

      compiler._udk.running = false;

      tap.mock.calls[0][2]({}, () => {});

      expect(compiler._udk.running).toBeTruthy();

      call = wpcFor.mock.calls.shift() as any[]; // tslint:disable-line:no-any
      tap = (wpcFor.mock.results.shift() as { value: { tap: jest.Mock } }).value.tap;

      expect(call[0]).toEqual('UdkDonePlugin');
      expect(tap.mock.calls.length).toEqual(1);
      expect(tap.mock.calls[0][0]).toEqual(compiler);
      expect(tap.mock.calls[0][1]).toEqual(WebpackCompilerStage.done);
      expect(typeof tap.mock.calls[0][2]).toEqual('function');

      const stats = {};
      compiler._udk.lastChange = { fileName: '', changeTime: NaN };
      compiler._udk.lastError = fakeError;
      compiler._udk.callbacks = [ () => {} ];

      expect(invalidate).not.toBeCalled();

      tap.mock.calls[0][2](stats);

      expect(invalidate).toBeCalled();
      expect(compiler._udk.lastError).toBeNull();
      expect(compiler._udk.lastStats).toBe(stats);
      expect(compiler._udk.callbacks.length).toEqual(0);

      const callback = jest.fn();

      tap.mock.calls[0][2](stats, callback);

      expect(callback).toBeCalled();

      call = wpcFor.mock.calls.shift() as any[]; // tslint:disable-line:no-any
      tap = (wpcFor.mock.results.shift() as { value: { tap: jest.Mock } }).value.tap;

      expect(call[0]).toEqual('UdkFailedPlugin');
      expect(tap.mock.calls.length).toEqual(1);
      expect(tap.mock.calls[0][0]).toEqual(compiler);
      expect(tap.mock.calls[0][1]).toEqual(WebpackCompilerStage.failed);
      expect(typeof tap.mock.calls[0][2]).toEqual('function');

      compiler._udk.callbacks = [ () => {} ];

      tap.mock.calls[0][2](fakeError);

      expect(compiler._udk.lastError).toBe(fakeError);
      expect(compiler._udk.lastStats).toBeNull();
      expect(compiler._udk.callbacks.length).toEqual(0);

      call = wpcFor.mock.calls.shift() as any[]; // tslint:disable-line:no-any
      tap = (wpcFor.mock.results.shift() as { value: { tap: jest.Mock } }).value.tap;

      expect(call[0]).toEqual('UdkInvalidPlugin');
      expect(tap.mock.calls.length).toEqual(1);
      expect(tap.mock.calls[0][0]).toEqual(compiler);
      expect(tap.mock.calls[0][1]).toEqual(WebpackCompilerStage.invalid);
      expect(typeof tap.mock.calls[0][2]).toEqual('function');

      tap.mock.calls[0][2]('fileName', 123);

      expect(compiler._udk.lastChange).toEqual({ fileName: 'fileName', changeTime: 123 });
    });
  });
});
