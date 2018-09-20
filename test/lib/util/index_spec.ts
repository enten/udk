// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as util from '../../../lib/util';

import { configLoader } from '../../../lib/util/configLoader';
import { decorateEventListener } from '../../../lib/util/decorateEventListener';
import { decorateRequestListener } from '../../../lib/util/decorateRequestListener';
import { ensureConfigHasEntry } from '../../../lib/util/ensureConfigHasEntry';
import { ensureConfigHasPlugin } from '../../../lib/util/ensureConfigHasPlugin';
import { existsModule } from '../../../lib/util/existsModule';
import { getEntryOutputPathFromStats } from '../../../lib/util/getEntryOutputPathFromStats';
import { getOutputPublicPath } from '../../../lib/util/getOutputPublicPath';
import {
  aliasModuleResolveFilename,
  disableModuleResolveFilenameHook,
  enableModuleResolveFilenameHook,
  hookModuleResolveFilename,
} from '../../../lib/util/hookResolveFilename';
import { packageVersion } from '../../../lib/util/packageVersion';
import { requireModule } from '../../../lib/util/requireModule';

describe('udk/lib/util/index', () => {
  it('should export utils', () => {
    expect(util.configLoader).toBe(configLoader);
    expect(util.decorateEventListener).toBe(decorateEventListener);
    expect(util.decorateRequestListener).toBe(decorateRequestListener);
    expect(util.ensureConfigHasEntry).toBe(ensureConfigHasEntry);
    expect(util.ensureConfigHasPlugin).toBe(ensureConfigHasPlugin);
    expect(util.existsModule).toBe(existsModule);
    expect(util.getEntryOutputPathFromStats).toBe(getEntryOutputPathFromStats);
    expect(util.getOutputPublicPath).toBe(getOutputPublicPath);
    expect(util.aliasModuleResolveFilename).toBe(aliasModuleResolveFilename);
    expect(util.disableModuleResolveFilenameHook).toBe(disableModuleResolveFilenameHook);
    expect(util.enableModuleResolveFilenameHook).toBe(enableModuleResolveFilenameHook);
    expect(util.hookModuleResolveFilename).toBe(hookModuleResolveFilename);
    expect(util.packageVersion).toBe(packageVersion);
    expect(util.requireModule).toBe(requireModule);
  });
});
