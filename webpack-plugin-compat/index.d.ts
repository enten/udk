// Type definitions for webpack-plugin-compat@1.0.1
// Project: https://github.com/chuckdumont/webpack-plugin-compat
// Definitions by: Steven Enten <steven@enten.fr>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

// declare module 'webpack-plugin-compat' {
  export = webpackPluginCompat;
// }

declare const webpackPluginCompat: WebpackPluginCompat;

type HookType = 'Sync'
  | 'SyncBail'
  | 'SyncWaterfall'
  | 'AsyncSeries'
  | 'AsyncSeriesWaterfall'
  | 'AsyncParalell'
  | 'AsyncParallelBail';

type HookCallback = (...args: any[]) => any;

type HookCallFn = (plugin: Tapable, eventName: string, ...args: any[]) => void;

interface HookTypeAndArgNames {
  [index: number]: string;
  0: HookType;
}

type Tapable = any;

interface WebpackPluginCompat extends WebpackPluginCompatCommon {
  for(pluginName: string): WebpackPluginCompatFor;
}

interface WebpackPluginCompatCommon {
  Tapable: Tapable;
  reg(
    obj: Tapable,
    hookName: string,
    hookTypeAndArgNames: HookTypeAndArgNames,
  ): void;
  reg(
    obj: Tapable,
    hookMap: { [hookName: string]: HookTypeAndArgNames },
  ): void;
  callSync: HookCallFn;
  callSyncBail: HookCallFn;
  callSyncWaterfall: HookCallFn;
  callAsyncSeries: HookCallFn;
  callAsyncSeriesWaterfall: HookCallFn;
  callAsyncParallel: HookCallFn;
  callAsyncParallelBail: HookCallFn;
}

interface WebpackPluginCompatFor extends WebpackPluginCompatCommon {
  tap(
    obj: Tapable,
    eventName: string,
    callback: HookCallback,
    context?: any,
  ): void;
  tap(
    obj: Tapable,
    eventMap: { [eventName: string]: HookCallback },
    context?: any,
  ): void;
  tap(
    obj: Tapable,
    eventArr: ([ string | string[], HookCallback ])[],
    context?: any,
  ): void;
}
