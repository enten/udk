// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import { Observable } from 'rxjs';

import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { colors } from '@angular-devkit/build-angular/src/utils/color';
import { assertCompatibleAngularVersion } from '@angular-devkit/build-angular/src/utils/version';
import { json } from '@angular-devkit/core';

import { UniversalServeOptions } from './types';

export * from './types';

export function ngUniversalServe(
  options: UniversalServeOptions,
  context: BuilderContext,
): Observable<BuilderOutput> {
  assertCompatibleAngularVersion(context.workspaceRoot, context.logger);

  printServeLabel(context);

  const ngUdkcArgs = [ '--target', options.universalTarget ];

  if (options.debug) {
    ngUdkcArgs.push('--debug');
  }

  return new Observable<BuilderOutput>(obs => {
    process.argv.splice(2, process.argv.length - 2, ...ngUdkcArgs);

    const { default: NgContainer } = require('./devContainer') as typeof import('./devContainer');
    const udkc = NgContainer(process);

    udkc.run(() => obs.next({ success: true }));

    return () => udkc.close();
  });
}

function printServeLabel(context: BuilderContext): void {
  const project = context.target && context.target.project;
  let label = colors.bgBlue(colors.bold(colors.black(' DEV ')));

  if (project) {
    const projectLabel = colors.bgWhite(colors.black(` ${project} `));
    label += ` ${projectLabel}`;
  }

  label += ' Running...';

  context.logger.info(label);
}

export default createBuilder<json.JsonObject & UniversalServeOptions>(ngUniversalServe);

// export function universalDevServerBuilder(
//   options: UniversalDevServerBuilderOptions,
//   context: BuilderContext,
// ) {
//   return new Promise<BuilderOutput>((resolve, reject) => {
//     context.reportStatus(`Executing "${options.command}"...`);
//     // const child = childProcess.spawn(options.command, options.args, { stdio: 'pipe' });

//     // child.stdout.on('data', (data) => {
//     //   context.logger.info(data.toString());
//     // });
//     // child.stderr.on('data', (data) => {
//     //   context.logger.error(data.toString());
//     //   reject();
//     // });

//     context.reportStatus(`Done.`);

//     resolve({
//       success: true
//     });
//     // child.on('close', code => {
//     //   resolve({ success: code === 0 });
//     // });
//   });
// }
