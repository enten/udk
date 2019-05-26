// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { FileReplacement } from '@angular-devkit/build-angular/src/browser/schema';

export { FileReplacement } from '@angular-devkit/build-angular/src/browser/schema';

export interface BuildUdkSchema {
  /**
   * TEMPORARY DISABLED. DO NOT USE.
   */
  main?: string;
  /**
   * Target to browser.
   */
  browserTarget: string;
  /**
   * Target to server.
   */
  serverTarget: string;
  /**
   * Partial webpack config for browser.
   */
  partialBrowserConfig?: string;
  /**
   * Partial webpack config for server.
   */
  partialServerConfig?: string;
  /**
   * Replace files with other files in the build.
   */
  fileReplacements?: FileReplacement[];
  /**
   * File loader emit file
   */
  fileLoaderEmitFile?: boolean;
  /**
   * Delete the output path before building.
   */
  deleteOutputPath?: boolean;
  /**
   * Adds more details to output logging.
   */
  verbose: boolean;
}
