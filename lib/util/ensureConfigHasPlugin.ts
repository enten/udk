// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as webpack from 'webpack';

export interface WebpackPluginStatic {
  new(...args: any[]): webpack.Plugin; // tslint:disable-line:no-any
}

export function ensureConfigHasPlugin(
  webpackConfig: webpack.Configuration | webpack.Configuration[],
  Plugin: WebpackPluginStatic,
  pluginArgs: any[] = [], // tslint:disable-line:no-any
): void {
  if (Array.isArray(webpackConfig)) {
    return webpackConfig.forEach(wconfig => ensureConfigHasPlugin(wconfig, Plugin, pluginArgs));
  }

  if (!getPluginFromConfig(webpackConfig, Plugin)) {
    const pluginInstance = new Plugin(...pluginArgs);

    if (!webpackConfig.plugins) {
      webpackConfig.plugins = [ pluginInstance ];
    } else {
      webpackConfig.plugins.push(pluginInstance);
    }
  }
}

export function getPluginFromConfig(
  webpackConfig: webpack.Configuration,
  Plugin: WebpackPluginStatic,
): webpack.Plugin | undefined {
  let plugin: webpack.Plugin | undefined;

  if (webpackConfig.plugins) {
    plugin = webpackConfig.plugins.find(configPlugin => {
      return configPlugin && configPlugin instanceof Plugin;
    });
  }

  return plugin;
}
