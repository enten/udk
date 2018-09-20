// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

export interface EnsureConfigHasEntryOptions {
  append?: boolean;
  entriesFilter?: string[] | ((entry: string) => boolean);
  topModuleEntries?: (string | RegExp)[];
}

export interface InModuleModuleNameTester {
  test: (entry: string) => boolean;
}

export type PathQueryObject = { [key: string]: any }; // tslint:disable-line:no-any
export type PathQuery = string | number | PathQueryObject;

export function ensureConfigHasEntry (
  webpackConfig: webpack.Configuration | webpack.Configuration[],
  entry: string | string[],
  entryQuery?: PathQuery | undefined,
  options: EnsureConfigHasEntryOptions = {},
): void {
  if (Array.isArray(webpackConfig)) {
    webpackConfig.forEach(value => ensureConfigHasEntry(value, entry, entryQuery, options));

    return;
  }

  if (Array.isArray(entry)) {
    entry.slice()
      .reverse()
      .forEach((e) => ensureConfigHasEntry(webpackConfig, e, entryQuery, options));

    return;
  }

  insertEntry(webpackConfig, 'entry', entry, entryQuery, options);
}

export function formatPathWithQuery (
  path: string,
  query?: PathQuery | undefined,
): string {
  if (query && typeof query === 'object') {
    query = Object.keys(query)
      .map((key) => `${key}=${(query as PathQueryObject)[key]}`)
      .join('&');
  }

  if (query) {
    const querySep = path.indexOf('?') !== -1 ? '&' : '?';

    path = path + querySep + query;
  }

  return path;
}

export function inModule(moduleName: string | InModuleModuleNameTester, entry: string) {
  // if (typeof entry !== 'string') {
  //   return false;
  // }

  while (entry.endsWith('/') || entry.endsWith('\\')) {
    entry = entry.substring(0, entry.length - 1);
  }

  if (typeof moduleName === 'object' && 'test' in (moduleName as InModuleModuleNameTester)) {
    return (moduleName as InModuleModuleNameTester).test(entry);
  }

  return entry === moduleName
    || entry.startsWith(moduleName + '/')
    || entry.startsWith(moduleName + '\\')
    || entry.startsWith(moduleName + '?');
}

export function insertEntry (
  // tslint:disable-next-line:no-any
  obj: any,
  key: string,
  entry: string,
  entryQuery?: PathQuery,
  options: EnsureConfigHasEntryOptions = {},
) {
  if (!obj[key]) {
    obj[key] = [];
  }

  if (typeof obj[key] === 'string') {
    obj[key] = [obj[key]];
  }

  if (!Array.isArray(obj[key])) {
    let {
      entriesFilter = () => true,
    } = options;

    if (Array.isArray(entriesFilter)) {
      entriesFilter = (entryName) => (options.entriesFilter as string[]).indexOf(entryName) !== -1;
    }

    Object.keys(obj[key]).filter(entriesFilter).forEach((entryName) => {
      insertEntry(obj[key], entryName, entry, entryQuery, options);
    });

    return obj;
  }

  const entries: string[] = obj[key];
  let {
    append,
    topModuleEntries,
  } = options;

  if (entry[0] === '+') {
    entry = entry.substring(1);
    append = true;
  }

  const hasEntry = entries.find((e) => inModule(entry, e));

  if (!hasEntry) {
    entry = formatPathWithQuery(entry, entryQuery);
    topModuleEntries = topModuleEntries || [];

    const topEntries = entries.filter((e) => {
      return (topModuleEntries as string[]).find((topEntry) => inModule(topEntry, e));
    });

    const nextEntries = entries.filter((e) => {
      return topEntries.indexOf(e) === -1;
    });

    nextEntries[append ? 'push' : 'unshift'].call(nextEntries, entry);

    if (topEntries.length) {
      nextEntries.unshift.apply(nextEntries, topEntries);
    }

    entries.length = 0;
    entries.push.apply(entries, nextEntries);
  }

  return obj;
}
