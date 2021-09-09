// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as path from 'path';
import * as webpack from 'webpack';

import {
  WebpackCompilationEntrypointsV4,
  WebpackStatsJson,
  WebpackStatsJsonChunk,
  getEntryOutputPathFromStats,
} from '../../../lib/util/getEntryOutputPathFromStats';

describe('udk/lib/util/getEntryOutputPathFromStats', () => { // tslint:disable-line:no-big-function
  describe('getEntryOutputPathFromStats', () => { // tslint:disable-line:no-big-function
    it('should throw error when given bad param', () => {
      try {
        // tslint:disable-next-line:no-any
        getEntryOutputPathFromStats(null as any);
        fail();
      } catch (err) {
        expect(err).toBeTruthy();
      }
    });

    it('should return null when output path cannot be found', () => {
      expect(getEntryOutputPathFromStats({})).toEqual(null);
    });

    it('should return output path from compilation v3', () => {
      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {} as object,
        },
      } as webpack.Stats)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            'main': {
              name: 'main',
              chunks: [],
            },
          } as object,
        },
      } as webpack.Stats)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            'main': {
              name: 'main',
              chunks: [
                {
                  name: 'main',
                  files: [ 'main.js' ],
                },
              ],
            },
          } as object,
        },
      } as webpack.Stats)).toEqual('main.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            'index': {
              name: 'index',
              chunks: [
                {
                  name: 'index',
                  files: [ 'index.js' ],
                },
              ],
            },
          } as object,
        },
      } as webpack.Stats)).toEqual('index.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            'server': {
              name: 'server',
              chunks: [
                {
                  name: 'server',
                  files: [ 'server.js' ],
                },
              ],
            },
          } as object,
        },
      } as webpack.Stats)).toEqual('server.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            'foo': {
              name: 'foo',
              chunks: [
                {
                  name: 'foo',
                  files: [ 'foo.js' ],
                },
              ],
            },
          } as object,
        },
      } as webpack.Stats, 'foo')).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            get: name => {},
          } as WebpackCompilationEntrypointsV4,
        },
      } as unknown as webpack.Stats, { entryName: 'foo' })).toEqual(null);

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            'bar': {
              name: 'bar',
              chunks: [
                {
                  name: 'bar',
                  files: [ 'bar.js' ],
                },
              ],
            },
          } as object,
          outputOptions: {
            path: 'foo',
          },
        },
      } as webpack.Stats, { entryName: 'bar' })).toEqual(path.join('foo', 'bar.js'));
    });

    it('should return output path from compilation v4', () => {
      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {} as WebpackCompilationEntrypointsV4,
        },
      } as unknown as webpack.Stats)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            get: name => {
              if (name === 'main') {
                return {
                  name: 'main',
                  chunks: [
                    {
                      name: 'main',
                      files: [ 'main.js' ],
                    },
                  ],
                };
              }

              return;
            },
          } as WebpackCompilationEntrypointsV4,
        },
      } as unknown as webpack.Stats)).toEqual('main.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            get: name => {
              if (name === 'index') {
                return {
                  name: 'index',
                  chunks: [
                    {
                      name: 'index',
                      files: [ 'index.js' ],
                    },
                  ],
                };
              }

              return;
            },
          } as WebpackCompilationEntrypointsV4,
        },
      } as unknown as webpack.Stats)).toEqual('index.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            get: name => {
              if (name === 'server') {
                return {
                  name: 'server',
                  chunks: [
                    {
                      name: 'server',
                      files: [ 'server.js' ],
                    },
                  ],
                };
              }

              return;
            },
          } as WebpackCompilationEntrypointsV4,
        },
      } as unknown as webpack.Stats)).toEqual('server.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            get: name => {
              if (name === 'foo') {
                return {
                  name: 'foo',
                  chunks: [
                    {
                      name: 'foo',
                      files: [ 'foo.js' ],
                    },
                  ],
                };
              }

              return;
            },
          } as WebpackCompilationEntrypointsV4,
        },
      } as unknown as webpack.Stats, 'foo')).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            get: name => {
              if (name === 'foo') {
                return {
                  name: 'foo',
                  chunks: [
                    {
                      name: 'foo',
                      files: [ 'foo.js' ],
                    },
                  ],
                };
              }

              return;
            },
          } as WebpackCompilationEntrypointsV4,
        },
      } as unknown as webpack.Stats, { entryName: 'foo' })).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        compilation: {
          entrypoints: {
            get: name => {
              if (name === 'bar') {
                return {
                  name: 'bar',
                  chunks: [
                    {
                      name: 'bar',
                      files: [ 'bar.js' ],
                    },
                  ],
                };
              }

              return;
            },
          } as WebpackCompilationEntrypointsV4,
          outputOptions: {
            path: 'foo',
          },
        },
      } as unknown as webpack.Stats, { entryName: 'bar' })).toEqual(path.join('foo', 'bar.js'));
    });

    it('should return output path from stats json entrypoints and chunks', () => {
      expect(getEntryOutputPathFromStats({} as WebpackStatsJson)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        chunks: [],
        entrypoints: {},
      } as WebpackStatsJson)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        chunks: [
          {
            id: 'main',
            names: [ 'main' ],
          } as WebpackStatsJsonChunk,
        ],
        entrypoints: {
          'main': {
            chunks: [ 'main' ],
          },
        },
      } as WebpackStatsJson)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        chunks: [
          {
            id: 'main',
            names: [ 'main' ],
            files: [ 'main.js' ],
          },
        ],
        entrypoints: {
          'main': {
            chunks: [ 'main' ],
          },
        },
      } as WebpackStatsJson)).toEqual('main.js');

      expect(getEntryOutputPathFromStats({
        chunks: [
          {
            id: 'index',
            names: [ 'index' ],
            files: [ 'index.js' ],
          },
        ],
        entrypoints: {
          'index': {
            chunks: [ 'index' ],
          },
        },
      } as WebpackStatsJson)).toEqual('index.js');

      expect(getEntryOutputPathFromStats({
        chunks: [
          {
            id: 'server',
            names: [ 'server' ],
            files: [ 'server.js' ],
          },
        ],
        entrypoints: {
          'server': {
            chunks: [ 'server' ],
          },
        },
      } as WebpackStatsJson)).toEqual('server.js');

      expect(getEntryOutputPathFromStats({
        chunks: [
          {
            id: 'foo',
            names: [ 'foo' ],
            files: [ 'foo.js' ],
          },
        ],
        entrypoints: {
          'foo': {
            chunks: [ 'foo' ],
          },
        },
      } as WebpackStatsJson, 'foo')).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        chunks: [
          {
            id: 'foo',
            names: [ 'foo' ],
            files: [ 'foo.js' ],
          },
        ],
        entrypoints: {
          'foo': {
            chunks: [ 'foo' ],
          },
        },
      } as WebpackStatsJson, { entryName: 'foo' })).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        chunks: [
          {
            id: 'bar',
            names: [ 'bar' ],
            files: [ 'bar.js' ],
          },
        ],
        entrypoints: {
          'bar': {
            chunks: [ 'bar' ],
          },
        },
      } as WebpackStatsJson, {
        entryName: 'bar',
        outputPath: 'foo',
      })).toEqual(path.join('foo', 'bar.js'));
    });

    it('should return output path from stats json assetsByChunkName', () => {
      expect(getEntryOutputPathFromStats({} as WebpackStatsJson)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        assetsByChunkName: {},
      } as WebpackStatsJson)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        assetsByChunkName: {
          'main': [ 'main.js' ],
        },
      } as WebpackStatsJson)).toEqual('main.js');

      expect(getEntryOutputPathFromStats({
        assetsByChunkName: {
          'index': [ 'index.js' ],
        },
      } as WebpackStatsJson)).toEqual('index.js');

      expect(getEntryOutputPathFromStats({
        assetsByChunkName: {
          'server': [ 'server.js' ],
        },
      } as WebpackStatsJson)).toEqual('server.js');

      expect(getEntryOutputPathFromStats({
        assetsByChunkName: {
          'foo': [ 'foo.js' ],
        },
      } as WebpackStatsJson, 'foo')).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        assetsByChunkName: {
          'foo': [ 'foo.js' ],
        },
      } as WebpackStatsJson, { entryName: 'foo' })).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        assetsByChunkName: {
          'bar': [ 'bar.js' ],
        },
      } as WebpackStatsJson, {
        entryName: 'bar',
        outputPath: 'foo',
      })).toEqual(path.join('foo', 'bar.js'));
    });

    it('should return output path from stats json assets', () => {
      expect(getEntryOutputPathFromStats({} as WebpackStatsJson)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        assets: [],
      } as WebpackStatsJson)).toEqual(null);

      expect(getEntryOutputPathFromStats({
        assets: [
          {
            name: 'main.js',
            chunkNames: [ 'main' ],
          },
        ],
      } as WebpackStatsJson)).toEqual('main.js');

      expect(getEntryOutputPathFromStats({
        assets: [
          {
            name: 'index.js',
            chunkNames: [ 'index' ],
          },
        ],
      } as WebpackStatsJson)).toEqual('index.js');

      expect(getEntryOutputPathFromStats({
        assets: [
          {
            name: 'server.js',
            chunkNames: [ 'server' ],
          },
        ],
      } as WebpackStatsJson)).toEqual('server.js');

      expect(getEntryOutputPathFromStats({
        assets: [
          {
            name: 'foo.js',
            chunkNames: [ 'foo' ],
          },
        ],
      } as WebpackStatsJson, 'foo')).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        assets: [
          {
            name: 'foo.js',
            chunkNames: [ 'foo' ],
          },
        ],
      } as WebpackStatsJson, { entryName: 'foo' })).toEqual('foo.js');

      expect(getEntryOutputPathFromStats({
        assets: [
          {
            name: 'bar.js',
            chunkNames: [ 'bar' ],
          },
        ],
      } as WebpackStatsJson, {
        entryName: 'bar',
        outputPath: 'foo',
      })).toEqual(path.join('foo', 'bar.js'));
    });
  });
});
