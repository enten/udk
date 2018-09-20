// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import udkc = require('../lib/devContainer');

const devContainer: udkc.ContainerAPI = udkc.default(process);

try {
  devContainer.run();
} catch (err) {
  console.error(err);
  process.exit(99);
}

export = devContainer;
