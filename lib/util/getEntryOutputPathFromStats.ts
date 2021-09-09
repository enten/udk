// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { join } from 'path';
import * as webpack from 'webpack';

export type GetEntryOutputPathFromStatsInput = webpack.Stats | WebpackStatsJson;

export interface GetEntryOutputPathOptions {
  entryName?: string;
  outputPath?: string;
}

export interface WebpackCompilationEntrypoint {
  name: string;
  chunks: WebpackCompilationEntrypointChunk[];
}

export interface WebpackCompilationEntrypointsV3 {
  [name: string]: WebpackCompilationEntrypoint;
}

export interface WebpackCompilationEntrypointsV4 extends Map<string, WebpackCompilationEntrypoint> {

}

export interface WebpackCompilationEntrypointChunk {
  name: string;
  files: string[];
}

export interface WebpackStatsJson {
  assetsByChunkName?: { [key: string]: string[]; };
  assets?: WebpackStatsJsonAsset[];
  chunks?: WebpackStatsJsonChunk[];
  entrypoints?: WebpackStatsJsonEntrypoints;
  [key: string]: any; // tslint:disable-line:no-any
}

export interface WebpackStatsJsonAsset {
  name: string;
  chunkNames: string[];
}

export interface WebpackStatsJsonEntrypoints {
  [key: string]: WebpackStatsJsonEntrypoint;
}

export interface WebpackStatsJsonEntrypoint {
  chunks: string[];
}

export interface WebpackStatsJsonChunk {
  id: string;
  files: string[];
  names: string[];
}

// re-écrire plus simplement
export function getEntryOutputPathFromStats(
  stats: GetEntryOutputPathFromStatsInput,
  entryNameOrOptions?: string | GetEntryOutputPathOptions,
): string|null {
  const options: GetEntryOutputPathOptions = typeof entryNameOrOptions === 'string'
    ? { entryName: entryNameOrOptions }
    : entryNameOrOptions || {};

  let { entryName, outputPath } = options;
  let entryFiles: string[]|null = null;
  let entryOutputPath: string;

  // try get entry files from compilation
  if ('compilation' in stats && (stats as webpack.Stats).compilation) {
    const { compilation } = stats as webpack.Stats;
    const { entrypoints } = compilation;

    let entry: WebpackCompilationEntrypoint | undefined;

    // Compatibility note:
    // * in webpack4, entrypoints is a Map object
    // * in webpack3, entrypoints is a plain object
    if (typeof entrypoints.get === 'function') {
      const entrypoinsMap = entrypoints as unknown as WebpackCompilationEntrypointsV4;

      entry = entryName
        ? entrypoinsMap.get(entryName)
        : entrypoinsMap.get('main')
          || entrypoinsMap.get('index')
          || entrypoinsMap.get('server');
    } else {
      const entrypointsObj = (entrypoints as object) as WebpackCompilationEntrypointsV3;

      entry = entryName
        ? entrypointsObj[entryName]
        : entrypointsObj.main
          || entrypointsObj.index
          || entrypointsObj.server;
    }

    if (!outputPath && compilation.outputOptions) {
      outputPath = compilation.outputOptions.path;
    }

    if (entry) {
      const entryNameFound = entry.name;
      const entryChunk = entry.chunks.find(chunk => chunk.name === entryNameFound);

      if (entryChunk) {
        entryFiles = entryChunk.files;
      }
    }
  }

  // try get entry files from stats json entrypoints and chunks
  if (!entryFiles && 'chunks' in stats && 'entrypoints' in stats) {
    const { chunks, entrypoints } = stats as {} as {
      chunks: WebpackStatsJsonChunk[],
      entrypoints: WebpackStatsJsonEntrypoints,
    };

    if (!entryName) {
      entryName = entrypoints.main
        ? 'main'
        : entrypoints.index
          ? 'index'
          : entrypoints.server
            ? 'server'
            : undefined;
    }

    if (entryName) {
      const entry = entrypoints[entryName];

      entryFiles = entry.chunks
        .map((chunkId: string) => {
          return chunks.find(chunk => chunk.id === chunkId);
        })
        .filter(chunk => {
          return chunk && chunk.names && ~chunk.names.indexOf(entryName as string);
        })
        .reduce((acc, chunk) => {
          return acc.concat(chunk && chunk.files || []);
        }, [] as string[]);
    }
  }

  // try get entry files from stats json assetsByChunkName
  if (!entryFiles && 'assetsByChunkName' in stats && stats.assetsByChunkName) {
    const { assetsByChunkName } = stats;

    entryFiles = entryName
      ? assetsByChunkName[entryName]
      : assetsByChunkName.main
        || assetsByChunkName.index
        || assetsByChunkName.server;
  }

  // try get entry files from stats json assets
  if (!entryFiles && 'assets' in stats && stats.assets) {
    const { assets } = stats;

    entryFiles = ([] as string[])
      .concat(entryName || ['main', 'index', 'server'])
      .map((chunkName) => {
        return assets.filter(asset => ~asset.chunkNames.indexOf(chunkName));
      })
      .reduce((acc, value) => {
        return acc.concat(value.map(asset => asset.name));
      }, [] as string[]);
  }

  entryOutputPath = '';

  if (entryFiles) {
    entryOutputPath = entryFiles.find((file) => file.endsWith('.js')) || '';
  }

  if (entryOutputPath && outputPath) {
    entryOutputPath = join(outputPath, entryOutputPath);
  }

  return entryOutputPath ? entryOutputPath : null;
}
