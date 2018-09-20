// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

import {
  ensureConfigHasEntry,
  formatPathWithQuery,
  inModule,
  insertEntry,
} from '../../../lib/util/ensureConfigHasEntry';

describe('udk/lib/util/ensureConfigHasEntry', () => {
  describe('ensureConfigHasEntry', () => {
    it('should add entry if is not exists', () => {
      let obj = {} as webpack.Configuration;
      ensureConfigHasEntry(obj, 'foo', 'bar');

      expect('entry' in obj).toBeTruthy();
      expect(obj.entry).toBeTruthy();
      expect(Array.isArray(obj.entry)).toBeTruthy();
      expect(Array.isArray(obj.entry) && obj.entry.length).toEqual(1);
      expect(obj.entry).toEqual([ 'foo?bar' ]);

      obj = { entry: { foo: [ 'bar' ], bar: [ 'foo' ] } };
      ensureConfigHasEntry(obj, 'foo');
      expect(obj.entry).toEqual({
        foo: [ 'foo', 'bar' ],
        bar: [ 'foo' ],
      });
    });

    it('should works with array of configs', () => {
      const obj = [ {}, {} ] as webpack.Configuration[];
      ensureConfigHasEntry(obj, 'foo');

      expect('entry' in obj[0]).toBeTruthy();
      expect(obj[0].entry).toBeTruthy();
      expect(Array.isArray(obj[0].entry)).toBeTruthy();
      expect(obj[0].entry).toEqual([ 'foo' ]);

      expect('entry' in obj[1]).toBeTruthy();
      expect(obj[1].entry).toBeTruthy();
      expect(Array.isArray(obj[1].entry)).toBeTruthy();
      expect(obj[1].entry).toEqual([ 'foo' ]);
    });

    it('should works with array of entry', () => {
      const obj = { entry: 'baz' } as webpack.Configuration;
      ensureConfigHasEntry(obj, [ 'foo', 'bar' ]);

      expect('entry' in obj).toBeTruthy();
      expect(obj.entry).toBeTruthy();
      expect(Array.isArray(obj.entry)).toBeTruthy();
      expect(Array.isArray(obj.entry) && obj.entry.length).toEqual(3);
      expect(obj.entry).toEqual([ 'foo', 'bar', 'baz' ]);
    });
  });

  describe('formatPathWithQuery', () => {
    it('should return given path when query is null or undefined', () => {
      // expect(formatPathWithQuery('foo', null)).toEqual('foo');
      expect(formatPathWithQuery('foo', undefined)).toEqual('foo');
    });

    it('should return given path with query string', () => {
      expect(formatPathWithQuery('foo', 'bar')).toEqual('foo?bar');
      expect(formatPathWithQuery('foo?bar', 'baz')).toEqual('foo?bar&baz');
    });

    it('should return given path with query object', () => {
      expect(formatPathWithQuery('foo', {})).toEqual('foo');
      expect(formatPathWithQuery('foo', { bar: 1 })).toEqual('foo?bar=1');
      expect(formatPathWithQuery('foo', { bar: 1, baz: 2 })).toEqual('foo?bar=1&baz=2');
      expect(formatPathWithQuery('foo?bar=1', { baz: 2 })).toEqual('foo?bar=1&baz=2');
    });
  });

  describe('inModule', () => {
    it('should return true when entry equals moduleName', () => {
      expect(inModule('foo', 'foo')).toBeTruthy();
    });

    it('should return true when entry starts with moduleName', () => {
      expect(inModule('foo', 'foo/bar')).toBeTruthy();
      expect(inModule('foo', 'foo/bar/')).toBeTruthy();
      expect(inModule('foo', 'foo\\bar')).toBeTruthy();
      expect(inModule('foo', 'foo?bar')).toBeTruthy();
      expect(inModule('fox', 'foo/bar')).toBeFalsy();
    });

    it('should works with tester', () => {
      expect(inModule({ test: () => true }, 'foo')).toBeTruthy();
      expect(inModule({ test: () => false }, 'foo')).toBeFalsy();
    });
  });

  describe('insertEntry', () => {
    // tslint:disable-next-line:no-any
    let obj: any = {};

    beforeEach(() => {
      obj = {};
    });

    it('should insert entry if is not exists', () => {
      insertEntry(obj, 'entry', 'foo');

      expect('entry' in obj).toBeTruthy();
      expect(obj.entry).toBeTruthy();
      expect(Array.isArray(obj.entry)).toBeTruthy();
      expect(obj.entry.length).toEqual(1);
      expect(obj.entry).toEqual([ 'foo' ]);

      insertEntry(obj, 'entry', 'foo');

      expect(obj.entry.length).toEqual(1);

      obj = { entry: 'foo' };
      insertEntry(obj, 'entry', 'foo');

      expect(obj.entry.length).toEqual(1);
      expect(obj.entry).toEqual([ 'foo' ]);
    });

    it('should unshift entry by default', () => {
      obj = { entry: [ 'bar' ] };
      insertEntry(obj, 'entry', 'foo');

      expect(obj.entry.length).toEqual(2);
      expect(obj.entry).toEqual([ 'foo', 'bar' ]);
    });

    it('should push entry when starts with "+" or with option append', () => {
      obj = { entry: [ 'foo' ] };
      insertEntry(obj, 'entry', '+bar');

      expect(obj.entry.length).toEqual(2);
      expect(obj.entry).toEqual([ 'foo', 'bar' ]);

      obj = { entry: [ 'foo' ] };
      insertEntry(obj, 'entry', 'bar', undefined, { append: true });

      expect(obj.entry.length).toEqual(2);
      expect(obj.entry).toEqual([ 'foo', 'bar' ]);
    });

    it('should handle option topModuleEntries', () => {
      obj = { entry: [ 'foo' ] };
      insertEntry(obj, 'entry', 'bar', undefined, { topModuleEntries: [ 'foo' ] });

      expect(obj.entry.length).toEqual(2);
      expect(obj.entry).toEqual([ 'foo', 'bar' ]);
    });

    it('should handle option entryFilter', () => {
      obj = { entry: { foo: 'bar', bar: 'bar' } };
      insertEntry(obj, 'entry', 'foo', undefined);

      expect(obj.entry.foo).toEqual([ 'foo', 'bar' ]);
      expect(obj.entry.bar).toEqual([ 'foo', 'bar' ]);

      obj = { entry: { foo: 'bar', bar: 'foo' } };
      insertEntry(obj, 'entry', 'foo', undefined, { entriesFilter: [ 'foo' ] });

      expect(obj.entry.foo.length).toEqual(2);
      expect(obj.entry.foo).toEqual([ 'foo', 'bar' ]);
      expect(obj.entry.bar).toEqual('foo');

      obj = { entry: { foo: 'bar', bar: 'foo' } };
      insertEntry(obj, 'entry', 'foo', undefined, { entriesFilter: e => e === 'foo' });

      expect(obj.entry.foo.length).toEqual(2);
      expect(obj.entry.foo).toEqual([ 'foo', 'bar' ]);
      expect(obj.entry.bar).toEqual('foo');
    });
  });
});
