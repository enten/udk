// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { PackageVersion, packageVersion } from '../../lib/util/packageVersion';

export const NG_CLI_VERSION: PackageVersion = packageVersion('@angular/cli');
// tslint:disable-next-line: max-line-length
export const NG_DEVKIT_VERSION: PackageVersion = packageVersion('@angular-devkit/build-angular');

export const NG_DEVKIT_0_12 = NG_DEVKIT_VERSION.major === 0
  ? NG_DEVKIT_VERSION.minor >= 12
  : NG_DEVKIT_VERSION.major > 0;
