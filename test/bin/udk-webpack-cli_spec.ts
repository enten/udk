// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import {
  aliasModuleResolveFilename,
  enableModuleResolveFilenameHook,
} from '../../lib/util/hookResolveFilename';

jest.mock('webpack-cli/bin/cli', () => {});
jest.mock('../../lib/util/hookResolveFilename');

afterAll(() => {
  jest.unmock('webpack-cli/bin/cli');
  jest.unmock('../../lib/util/hookResolveFilename');
});

describe('udk/bin/udk-webpack-cli', () => {
  it('should alias webpack module with udk webpack in webpack-cli/bin/cli', () => {
    require('../../bin/udk-webpack-cli');

    expect((enableModuleResolveFilenameHook as jest.Mock).mock.calls.length).toEqual(1);
    expect((aliasModuleResolveFilename as jest.Mock).mock.calls.length).toEqual(1);
    expect((aliasModuleResolveFilename as jest.Mock).mock.calls[0][0]).toEqual({
      fromFile: 'webpack-cli/bin/cli',
      replaceRequest: 'webpack',
      withRequest: 'udk/lib/webpack',
    });
  });
});
