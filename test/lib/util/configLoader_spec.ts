// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

const webpackConfigLoader: jest.Mock = require('@webpack-contrib/config-loader');

jest.mock('@webpack-contrib/config-loader', () => jest.fn());

afterAll(() => {
  jest.unmock('@webpack-contrib/config-loader');
  jest.unmock('../../../lib/util/hookResolveFilename');
  jest.unmock('../../../lib/util/packageVersion');
});

describe('udk/lib/configLoader', () => {
  beforeEach(() => {
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should use @webpack-contrib/config-loader to load config', () => {
    const { configLoader } = require('../../../lib/util/configLoader');
    const options = {};

    configLoader(options);

    expect(webpackConfigLoader).toBeCalled();
  });

  it('should be compat with webpack v3', () => {
    jest.mock('../../../lib/util/hookResolveFilename');
    jest.mock('../../../lib/util/packageVersion', () => ({
      packageVersion: () => ({ major: 3 }),
    }));

    const hrf = require('../../../lib/util/hookResolveFilename');

    require('../../../lib/util/configLoader');

    expect(hrf.enableModuleResolveFilenameHook).toBeCalled();
    expect(hrf.aliasModuleResolveFilename).toBeCalled();
  });
});
