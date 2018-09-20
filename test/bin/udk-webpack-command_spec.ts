// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import {
  aliasModuleResolveFilename,
  enableModuleResolveFilenameHook,
} from '../../lib/util/hookResolveFilename';

jest.mock('webpack-command/lib/cli', () => {});
jest.mock('../../lib/util/hookResolveFilename');

afterAll(() => {
  jest.unmock('webpack-command/lib/cli');
  jest.unmock('../../lib/util/hookResolveFilename');
});

describe('udk/bin/udk-webpack-command', () => {
  it('should alias webpack module with udk webpack in webpack-command/lib/compiler', () => {
    require('../../bin/udk-webpack-command');

    expect((enableModuleResolveFilenameHook as jest.Mock).mock.calls.length).toEqual(1);
    expect((aliasModuleResolveFilename as jest.Mock).mock.calls.length).toEqual(1);
    expect((aliasModuleResolveFilename as jest.Mock).mock.calls[0][0]).toEqual({
      fromFile: 'webpack-command/lib/compiler',
      replaceRequest: 'webpack',
      withRequest: 'udk/lib/webpack',
    });
  });
});
