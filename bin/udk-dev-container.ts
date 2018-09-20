// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import DevContainer, { ContainerAPI } from '../lib/devContainer';

const udkc: ContainerAPI = DevContainer(process);

try {
  udkc.run();
} catch (err) {
  console.error(err);
  process.exit(99);
}

export = udkc;
