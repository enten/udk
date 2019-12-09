#!/usr/bin/env node
// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import NgContainer, { NgContainerAPI } from '../lib/serve/devContainer';

const udkc: NgContainerAPI = NgContainer(process);

try {
  udkc.run();
} catch (err) {
  console.error(err);

  process.exit(1);
}

export = udkc;
