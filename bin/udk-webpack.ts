// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { packageVersion } from '../lib/util/packageVersion';

if (packageVersion('webpack').major > 3) {
  require('./udk-webpack4');
} else {
  require('./udk-webpack3');
}
