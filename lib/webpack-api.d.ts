// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

declare interface WebpackAPI {
  // (
  //   options: webpack.Configuration,
  //   handler: WebpackCompilerHandler,
  // ): webpack.Watching | webpack.Compiler;
  // (options?: webpack.Configuration): webpack.Compiler;

  // (
  //   options: webpack.Configuration[],
  //   handler: webpack.MultiCompiler.Handler,
  // ): webpack.MultiWatching | webpack.MultiCompiler;
  // (options: webpack.Configuration[]): webpack.MultiCompiler;

  (
    options: webpack.Configuration | webpack.Configuration[],
    callback?: webpack.Compiler.Handler | webpack.MultiCompiler.Handler,
  ): webpack.Watching | webpack.Compiler | webpack.MultiWatching | webpack.MultiCompiler;

  version: string;

  WebpackOptionsDefaulter: WebpackStatic;
  WebpackOptionsApply: WebpackStatic;
  Compiler: WebpackStatic<webpack.Compiler>;
  MultiCompiler: WebpackStatic<webpack.MultiCompiler>;
  NodeEnvironmentPlugin: WebpackStatic<webpack.Plugin>;
  // tslint:disable-next-line:no-any
  validate: (option: any) => any;
  // tslint:disable-next-line:no-any
  validateSchema: (schema: any, option: any) => any;
  WebpackOptionsValidationError: WebpackStatic;

  AutomaticPrefetchPlugin: WebpackStatic<webpack.Plugin>;
  BannerPlugin: WebpackStatic<webpack.BannerPlugin>;
  CachePlugin: WebpackStatic<webpack.Plugin>;
  ContextExclusionPlugin: WebpackStatic<webpack.Plugin>;
  ContextReplacementPlugin: WebpackStatic<webpack.ContextReplacementPlugin>;
  DefinePlugin: WebpackStatic<webpack.DefinePlugin>;
  Dependency: WebpackStatic;
  DllPlugin: WebpackStatic<webpack.DllPlugin>;
  DllReferencePlugin: WebpackStatic<webpack.DllReferencePlugin>;
  EnvironmentPlugin: WebpackStatic<webpack.EnvironmentPlugin>;
  EvalDevToolModulePlugin: WebpackStatic<webpack.Plugin>;
  EvalSourceMapDevToolPlugin: WebpackStatic<webpack.EvalSourceMapDevToolPlugin>;
  ExtendedAPIPlugin: WebpackStatic<webpack.ExtendedAPIPlugin>;
  ExternalsPlugin: WebpackStatic<webpack.Plugin>;
  HashedModuleIdsPlugin: WebpackStatic<webpack.HashedModuleIdsPlugin>;
  HotModuleReplacementPlugin: WebpackStatic<webpack.HotModuleReplacementPlugin>;
  IgnorePlugin: WebpackStatic<webpack.IgnorePlugin>;
  LibraryTemplatePlugin: WebpackStatic<webpack.Plugin>;
  LoaderOptionsPlugin: WebpackStatic<webpack.LoaderOptionsPlugin>;
  LoaderTargetPlugin: WebpackStatic<webpack.Plugin>;
  MemoryOutputFileSystem: WebpackStatic;
  Module: WebpackStatic<webpack.Module>;
  // tslint:disable-next-line:no-any
  ModuleFilenameHelpers: any;
  NamedChunksPlugin: WebpackStatic<webpack.NamedChunksPlugin>;
  NamedModulesPlugin: WebpackStatic<webpack.NamedModulesPlugin>;
  NoEmitOnErrorsPlugin: WebpackStatic<webpack.NoEmitOnErrorsPlugin>;
  NormalModuleReplacementPlugin: WebpackStatic<webpack.NormalModuleReplacementPlugin>;
  PrefetchPlugin: WebpackStatic<webpack.PrefetchPlugin>;
  ProgressPlugin: WebpackStatic<webpack.ProgressPlugin>;
  ProvidePlugin: WebpackStatic<webpack.ProvidePlugin>;
  SetVarMainTemplatePlugin: WebpackStatic<webpack.Plugin>;
  SingleEntryPlugin: WebpackStatic<webpack.Plugin>;
  SourceMapDevToolPlugin: WebpackStatic<webpack.SourceMapDevToolPlugin>;
  Stats: WebpackStatsExports;
  Template: WebpackStatic;
  UmdMainTemplatePlugin: WebpackStatic<webpack.Plugin>;
  WatchIgnorePlugin: WebpackStatic<webpack.WatchIgnorePlugin>;
  dependencies: {
    DependencyReference: WebpackStatic;
  };
  optimize: {
    AggressiveMergingPlugin: WebpackStatic<webpack.optimize.AggressiveMergingPlugin>;
    AggressiveSplittingPlugin: WebpackStatic<webpack.Plugin>;
    ChunkModuleIdRangePlugin: WebpackStatic<webpack.Plugin>;
    LimitChunkCountPlugin: WebpackStatic<webpack.optimize.LimitChunkCountPlugin>;
    MinChunkSizePlugin: WebpackStatic<webpack.optimize.MinChunkSizePlugin>;
    ModuleConcatenationPlugin: WebpackStatic<webpack.optimize.ModuleConcatenationPlugin>;
    OccurrenceOrderPlugin: WebpackStatic<webpack.optimize.OccurrenceOrderPlugin>;
    OccurrenceModuleOrderPlugin: WebpackStatic<webpack.Plugin>;
    OccurrenceChunkOrderPlugin: WebpackStatic<webpack.Plugin>;
    RuntimeChunkPlugin: WebpackStatic<webpack.Plugin>;
    SideEffectsFlagPlugin: WebpackStatic<webpack.Plugin>;
    SplitChunksPlugin: WebpackStatic<webpack.Plugin>;
    // missing plugins
    UglifyJsPlugin: WebpackStatic<webpack.Plugin>;
    CommonsChunkPlugin: WebpackStatic<webpack.Plugin>;
  };
  web: {
    FetchCompileWasmTemplatePlugin: WebpackStatic<webpack.Plugin>;
    JsonpTemplatePlugin: WebpackStatic<webpack.Plugin>;
  };
  webworker: {
    WebWorkerTemplatePlugin: WebpackStatic<webpack.Plugin>;
  };
  node: {
    NodeTemplatePlugin: WebpackStatic<webpack.Plugin>;
    ReadFileCompileWasmTemplatePlugin: WebpackStatic<webpack.Plugin>;
  };
  debug: {
    ProfilingPlugin: WebpackStatic<webpack.debug.ProfilingPlugin>;
  };
  util: {
    createHash: (algorithm: string | (() => string)) => string;
  };
}

declare interface WebpackStatic<T = any> {
  new(...args: any[]): T;
}

declare interface WebpackStatsExports extends WebpackStatic<webpack.Stats> {
  presetToOptions(name: webpack.Stats.Preset): webpack.Stats.ToJsonOptionsObject;
}
