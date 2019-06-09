// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

// tslint:disable:no-global-tslint-disable no-implicit-dependencies

import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { json } from '@angular-devkit/core';
import { Observable } from 'rxjs';


export function runUniversal(
  options: json.JsonObject & { debug?: boolean },
  context: BuilderContext,
) {
  const projectName = context.target && context.target.project;

  // tslint:disable-next-line: max-line-length
  context.logger.info(`\u001b[7m\u001b[34m\u001b[1m DEV \u001b[22m\u001b[39m\u001b[27m \u001b[7m\u001b[37m ${projectName} \u001b[39m\u001b[27m Running...`);

  const ngUdkcArgs = [ '--project', projectName as string ];

  if (context.target && context.target.configuration) {
    ngUdkcArgs.push('--configuration', context.target.configuration);
  }

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


export default createBuilder<json.JsonObject>(runUniversal);
