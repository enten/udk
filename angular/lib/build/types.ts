// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import { ScriptTarget } from 'typescript';
import webpack = require('webpack');

import { BuilderOutput } from '@angular-devkit/architect';
import { Schema as BrowserBuilderOptions } from '@angular-devkit/build-angular/src/browser/schema';
import { Schema as ServerBuilderOptions } from '@angular-devkit/build-angular/src/server/schema';
import { I18nOptions } from '@angular-devkit/build-angular/src/utils/i18n-options';
import { EmittedFiles } from '@angular-devkit/build-webpack';
import { json } from '@angular-devkit/core';


export { Schema as BrowserBuilderOptions } from '@angular-devkit/build-angular/src/browser/schema';
export { Schema as ServerBuilderOptions } from '@angular-devkit/build-angular/src/server/schema';

export interface FileReplacement {
  replace?: string;
  replaceWith?: string;
  src?: string;
  with?: string;
}

export interface UniversalBuildOptions {
  /**
   * Target to browser.
   */
  browserTarget: string;
  /**
   * Target to server.
   */
  serverTarget: string;
  /**
   * Array of RegExp patterns to match require request of dependencies to bundle.
   */
  bundleDependenciesWhitelist?: string[];
  /**
   * Delete the output path before building.
   */
  deleteOutputPath?: boolean;
  /**
   * File loader emit file
   */
  fileLoaderEmitFile?: boolean;
  /**
   * Replace files with other files in the build.
   */
  fileReplacements?: FileReplacement[];
  /**
   * Partial webpack config for browser.
   */
  partialBrowserConfig?: string;
  /**
   * Partial webpack config for server.
   */
  partialServerConfig?: string;
  /**
   * Adds more details to output logging.
   */
  verbose?: boolean;
}

export declare type UniversalBuildOutput = json.JsonObject & BuilderOutput & {
  hash: string;
  browserSuccess: boolean;
  browserEmittedFiles: EmittedFiles[];
  browserOptions: BrowserBuilderOptions;
  serverSuccess: boolean;
  serverEmittedFiles: EmittedFiles[];
  serverOptions: ServerBuilderOptions;
};

export declare type UniversalCompilationOutput = json.JsonObject & BuilderOutput & {
  hash: string;
  browserSuccess: boolean;
  browserStats: webpack.Stats;
  browserEmittedFiles: EmittedFiles[];
  serverSuccess: boolean;
  serverStats: webpack.Stats;
  serverEmittedFiles: EmittedFiles[];
};

export interface BuilderInitContext<T> {
  options: T;
  config: webpack.Configuration;
  projectRoot: string;
  projectSourceRoot?: string;
  i18n: I18nOptions;
}

export interface BrowserBuilderInitContext extends BuilderInitContext<BrowserBuilderOptions> {
  isDifferentialLoadingNeeded: boolean;
  target: ScriptTarget;
  useBundleDownleveling: boolean;
}

export interface ServerBuilderInitContext extends BuilderInitContext<ServerBuilderOptions> {
  target: ScriptTarget;
}

export interface UniversalTargetOptionsMap {
  browser: BrowserBuilderOptions;
  server: ServerBuilderOptions;
}
