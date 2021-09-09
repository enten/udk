// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
'use strict';

import webpack = require('webpack');

import MultiCompiler from './MultiCompiler';
import { WebpackAPI, WebpackStatic } from './webpack-api';

const Compiler: WebpackStatic<webpack.Compiler> = require('webpack/lib/Compiler');
const NodeEnvironmentPlugin: WebpackStatic<webpack.EnvironmentPlugin> = require('webpack/lib/node/NodeEnvironmentPlugin'); // tslint:disable-line:max-line-length
const WebpackOptionsApply: WebpackStatic = require('webpack/lib/WebpackOptionsApply');
const WebpackOptionsDefaulter: WebpackStatic = require('webpack/lib/WebpackOptionsDefaulter');
const validateSchema = require('webpack/lib/validateSchema');
const WebpackOptionsValidationError: WebpackStatic = require('webpack/lib/WebpackOptionsValidationError'); // tslint:disable-line:max-line-length
const webpackOptionsSchema = require('webpack/schemas/WebpackOptions.json');
const RemovedPluginError: WebpackStatic<WebpackStatic> = require('webpack/lib/RemovedPluginError');
const version: string = require('webpack/package.json').version;

const webpackV4 = ((options, callback?) => {
  const webpackOptionsValidationErrors = validateSchema(
    webpackOptionsSchema,
    options,
  );
  if (webpackOptionsValidationErrors.length) {
    throw new WebpackOptionsValidationError(webpackOptionsValidationErrors);
  }
  let compiler: webpack.Compiler | webpack.MultiCompiler;
  if (Array.isArray(options)) {
    compiler = new MultiCompiler(options.map(options => webpack(options)));
  } else if (typeof options === 'object') {
    options = new WebpackOptionsDefaulter().process(options) as webpack.Configuration;

    compiler = new Compiler(options.context);
    compiler.options = options as webpack.WebpackOptionsNormalized;
    new NodeEnvironmentPlugin().apply(compiler);
    if (options.plugins && Array.isArray(options.plugins)) {
      for (const plugin of options.plugins) {
        (plugin as webpack.WebpackPluginInstance).apply(compiler);
      }
    }
    compiler.hooks.environment.call();
    compiler.hooks.afterEnvironment.call();
    compiler.options = new WebpackOptionsApply().process(options, compiler);
  } else {
    throw new Error('Invalid argument: options');
  }
  if (callback) {
    if (typeof callback !== 'function') {
      throw new Error('Invalid argument: callback');
    }
    if (
      (options as webpack.Configuration).watch === true ||
      (Array.isArray(options) && options.some(o => (o.watch as boolean)))
    ) {
      const watchOptions = Array.isArray(options)
        ? options.map(o => o.watchOptions || {})
        : options.watchOptions || {};

      return compiler.watch(
        watchOptions as webpack.Watching['watchOptions'],
        callback as any,
      );
    }
    compiler.run(callback as any);
  }

  return compiler;
}) as WebpackAPI;

webpackV4.version = version;

webpackV4.WebpackOptionsDefaulter = WebpackOptionsDefaulter;
webpackV4.WebpackOptionsApply = WebpackOptionsApply;
webpackV4.Compiler = Compiler;
webpackV4.MultiCompiler = MultiCompiler;
webpackV4.NodeEnvironmentPlugin = NodeEnvironmentPlugin;
// @ts-ignore Global @this directive is not supported
webpackV4.validate = validateSchema.bind(this, webpackOptionsSchema);
webpackV4.validateSchema = validateSchema;
webpackV4.WebpackOptionsValidationError = WebpackOptionsValidationError;

// tslint:disable-next-line:no-any
const exportPlugins = (obj: object, mappings: { [name: string]: any }) => {
  for (const name of Object.keys(mappings)) {
    Object.defineProperty(obj, name, {
      configurable: false,
      enumerable: true,
      get: mappings[name],
    });
  }
};

exportPlugins(webpackV4, {
  AutomaticPrefetchPlugin: () => require('webpack/lib/AutomaticPrefetchPlugin'),
  BannerPlugin: () => require('webpack/lib/BannerPlugin'),
  CachePlugin: () => require('webpack/lib/CachePlugin'),
  ContextExclusionPlugin: () => require('webpack/lib/ContextExclusionPlugin'),
  ContextReplacementPlugin: () => require('webpack/lib/ContextReplacementPlugin'),
  DefinePlugin: () => require('webpack/lib/DefinePlugin'),
  Dependency: () => require('webpack/lib/Dependency'),
  DllPlugin: () => require('webpack/lib/DllPlugin'),
  DllReferencePlugin: () => require('webpack/lib/DllReferencePlugin'),
  EnvironmentPlugin: () => require('webpack/lib/EnvironmentPlugin'),
  EvalDevToolModulePlugin: () => require('webpack/lib/EvalDevToolModulePlugin'),
  EvalSourceMapDevToolPlugin: () => require('webpack/lib/EvalSourceMapDevToolPlugin'),
  ExtendedAPIPlugin: () => require('webpack/lib/ExtendedAPIPlugin'),
  ExternalsPlugin: () => require('webpack/lib/ExternalsPlugin'),
  HashedModuleIdsPlugin: () => require('webpack/lib/HashedModuleIdsPlugin'),
  HotModuleReplacementPlugin: () => require('webpack/lib/HotModuleReplacementPlugin'),
  IgnorePlugin: () => require('webpack/lib/IgnorePlugin'),
  LibraryTemplatePlugin: () => require('webpack/lib/LibraryTemplatePlugin'),
  LoaderOptionsPlugin: () => require('webpack/lib/LoaderOptionsPlugin'),
  LoaderTargetPlugin: () => require('webpack/lib/LoaderTargetPlugin'),
  MemoryOutputFileSystem: () => require('webpack/lib/MemoryOutputFileSystem'),
  Module: () => require('webpack/lib/Module'),
  ModuleFilenameHelpers: () => require('webpack/lib/ModuleFilenameHelpers'),
  NamedChunksPlugin: () => require('webpack/lib/NamedChunksPlugin'),
  NamedModulesPlugin: () => require('webpack/lib/NamedModulesPlugin'),
  NoEmitOnErrorsPlugin: () => require('webpack/lib/NoEmitOnErrorsPlugin'),
  NormalModuleReplacementPlugin: () =>
    require('webpack/lib/NormalModuleReplacementPlugin'),
  PrefetchPlugin: () => require('webpack/lib/PrefetchPlugin'),
  ProgressPlugin: () => require('webpack/lib/ProgressPlugin'),
  ProvidePlugin: () => require('webpack/lib/ProvidePlugin'),
  SetVarMainTemplatePlugin: () => require('webpack/lib/SetVarMainTemplatePlugin'),
  SingleEntryPlugin: () => require('webpack/lib/SingleEntryPlugin'),
  SourceMapDevToolPlugin: () => require('webpack/lib/SourceMapDevToolPlugin'),
  Stats: () => require('webpack/lib/Stats'),
  Template: () => require('webpack/lib/Template'),
  UmdMainTemplatePlugin: () => require('webpack/lib/UmdMainTemplatePlugin'),
  WatchIgnorePlugin: () => require('webpack/lib/WatchIgnorePlugin'),
});
exportPlugins((webpackV4.dependencies = {} as WebpackAPI['dependencies']), {
  DependencyReference: () => require('webpack/lib/dependencies/DependencyReference'),
});
exportPlugins((webpackV4.optimize = {} as WebpackAPI['optimize']), {
  AggressiveMergingPlugin: () => require('webpack/lib/optimize/AggressiveMergingPlugin'),
  AggressiveSplittingPlugin: () =>
    require('webpack/lib/optimize/AggressiveSplittingPlugin'),
  ChunkModuleIdRangePlugin: () =>
    require('webpack/lib/optimize/ChunkModuleIdRangePlugin'),
  LimitChunkCountPlugin: () => require('webpack/lib/optimize/LimitChunkCountPlugin'),
  MinChunkSizePlugin: () => require('webpack/lib/optimize/MinChunkSizePlugin'),
  ModuleConcatenationPlugin: () =>
    require('webpack/lib/optimize/ModuleConcatenationPlugin'),
  OccurrenceOrderPlugin: () => require('webpack/lib/optimize/OccurrenceOrderPlugin'),
  OccurrenceModuleOrderPlugin: () =>
    require('webpack/lib/optimize/OccurrenceModuleOrderPlugin'),
  OccurrenceChunkOrderPlugin: () =>
    require('webpack/lib/optimize/OccurrenceChunkOrderPlugin'),
  RuntimeChunkPlugin: () => require('webpack/lib/optimize/RuntimeChunkPlugin'),
  SideEffectsFlagPlugin: () => require('webpack/lib/optimize/SideEffectsFlagPlugin'),
  SplitChunksPlugin: () => require('webpack/lib/optimize/SplitChunksPlugin'),
});
exportPlugins((webpackV4.web = {} as WebpackAPI['web']), {
  FetchCompileWasmTemplatePlugin: () =>
    require('webpack/lib/web/FetchCompileWasmTemplatePlugin'),
  JsonpTemplatePlugin: () => require('webpack/lib/web/JsonpTemplatePlugin'),
});
exportPlugins((webpackV4.webworker = {} as WebpackAPI['webworker']), {
  WebWorkerTemplatePlugin: () => require('webpack/lib/webworker/WebWorkerTemplatePlugin'),
});
exportPlugins((webpackV4.node = {} as WebpackAPI['node']), {
  NodeTemplatePlugin: () => require('webpack/lib/node/NodeTemplatePlugin'),
  ReadFileCompileWasmTemplatePlugin: () =>
    require('webpack/lib/node/ReadFileCompileWasmTemplatePlugin'),
});
exportPlugins((webpackV4.debug = {} as WebpackAPI['debug']), {
  ProfilingPlugin: () => require('webpack/lib/debug/ProfilingPlugin'),
});
exportPlugins((webpackV4.util = {} as WebpackAPI['util']), {
  createHash: () => require('webpack/lib/util/createHash'),
});

const defineMissingPluginError = (namespace: object, pluginName: string, errorMessage: string) => {
  Object.defineProperty(namespace, pluginName, {
    configurable: false,
    enumerable: true,
    get() {
      throw new RemovedPluginError(errorMessage);
    },
  });
};

// TODO remove in webpack 5
defineMissingPluginError(
  webpackV4.optimize,
  'UglifyJsPlugin',
  // tslint:disable-next-line:max-line-length
  'webpack.optimize.UglifyJsPlugin has been removed, please use config.optimization.minimize instead.',
);

// TODO remove in webpack 5
defineMissingPluginError(
  webpackV4.optimize,
  'CommonsChunkPlugin',
  // tslint:disable-next-line:max-line-length
  'webpack.optimize.CommonsChunkPlugin has been removed, please use config.optimization.splitChunks instead.',
);

export = webpackV4;
