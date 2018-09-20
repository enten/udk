// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import {
  aliasModuleResolveFilename,
  enableModuleResolveFilenameHook,
} from '../../lib/util/hookResolveFilename';

jest.mock('webpack/bin/webpack', () => {});
jest.mock('../../lib/util/hookResolveFilename');

afterAll(() => {
  jest.unmock('webpack/bin/webpack');
  jest.unmock('../../lib/util/hookResolveFilename');
});

describe('udk/bin/udk-webpack3', () => {

  it('should alias webpack module with udk webpack in webpack/bin/webpack', () => {
    require('../../bin/udk-webpack3');

    expect((enableModuleResolveFilenameHook as jest.Mock).mock.calls.length).toEqual(1);
    expect((aliasModuleResolveFilename as jest.Mock).mock.calls.length).toEqual(1);
    expect((aliasModuleResolveFilename as jest.Mock).mock.calls[0][0]).toEqual({
      fromFile: 'webpack/bin/webpack',
      replaceRequest: '../lib/webpack.js',
      withRequest: 'udk/lib/webpack',
    });
  });
});
