// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

import { getOutputPublicPath } from '../../../lib/util/getOutputPublicPath';

describe('getOutputPublicPath.ts', () => {
  describe('getOutputPublicPath', () => {
    it('should return "/" when given bad param', () => {
      expect(getOutputPublicPath(null)).toEqual('/');
      expect(getOutputPublicPath(undefined)).toEqual('/');
    });

    it('should return given url when param is a string', () => {
      expect(getOutputPublicPath('/')).toEqual('/');
      expect(getOutputPublicPath('/foo')).toEqual('/foo');
    });

    it('should remove base url when option pathOnly is true', () => {
      expect(getOutputPublicPath('http://foo/bar', { pathOnly: true })).toEqual('/bar');
      expect(getOutputPublicPath('http://foo/bar', { pathOnly: false })).toEqual('http://foo/bar');
    });

    it('should add ends slash when option endsSlash is true', () => {
      expect(getOutputPublicPath('/foo', { endsSlash: true })).toEqual('/foo/');
      expect(getOutputPublicPath('/foo/', { endsSlash: true })).toEqual('/foo/');

      expect(getOutputPublicPath('/foo', { endsSlash: false })).toEqual('/foo');
      expect(getOutputPublicPath('/foo/', { endsSlash: false })).toEqual('/foo');
    });

    it('should add starts slash when option startsSlash is true', () => {
      expect(getOutputPublicPath('foo', { startsSlash: true })).toEqual('/foo');
      expect(getOutputPublicPath('/foo', { startsSlash: true })).toEqual('/foo');

      expect(getOutputPublicPath('foo', { startsSlash: false })).toEqual('foo');
      expect(getOutputPublicPath('/foo', { startsSlash: false })).toEqual('foo');
    });

    it('should reduce from highest potential object to webpack config options output', () => {
      expect(getOutputPublicPath({
        compilation: {
          compiler: {
            options: {
              output: {
                publicPath: 'http://foo/bar/',
              },
            },
          },
        },
      } as { compilation: webpack.Compilation }, {
        endsSlash: false,
        pathOnly: true,
        startsSlash: false,
      })).toEqual('bar');

      expect(getOutputPublicPath({
        compiler: {
          options: {
            output: {
              publicPath: 'http://foo/bar/',
            },
          },
        },
      } as webpack.Compilation, {
        endsSlash: false,
        pathOnly: true,
        startsSlash: false,
      })).toEqual('bar');

      expect(getOutputPublicPath({
        options: {
          output: {
            publicPath: 'http://foo/bar/',
          },
        },
      } as webpack.Compiler, {
        endsSlash: false,
        pathOnly: true,
        startsSlash: false,
      })).toEqual('bar');

      expect(getOutputPublicPath({
        output: {
          publicPath: 'http://foo/bar/',
        },
      } as webpack.Configuration, {
        endsSlash: false,
        pathOnly: true,
        startsSlash: false,
      })).toEqual('bar');

      expect(getOutputPublicPath({
        publicPath: 'http://foo/bar/',
      } as any, {
        endsSlash: false,
        pathOnly: true,
        startsSlash: false,
      })).toEqual('bar');

      expect(getOutputPublicPath('http://foo/bar/', {
        endsSlash: false,
        pathOnly: true,
        startsSlash: false,
      })).toEqual('bar');

      expect(getOutputPublicPath({}, {
        endsSlash: false,
        pathOnly: true,
        startsSlash: false,
      })).toEqual('');
    });
  });
});
