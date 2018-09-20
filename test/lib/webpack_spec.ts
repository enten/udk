// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

jest.mock('../../lib/webpack.v3', () => ({ version: 3 }));
jest.mock('../../lib/webpack.v4', () => ({ version: 4 }));

afterAll(() => {
  jest.unmock('../../lib/webpack.v3');
  jest.unmock('../../lib/webpack.v4');
});

describe('udk/lib/webpack', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.unmock('../../lib/util/packageVersion');
  });

  it('should return udk/lib/webpack.v3 when webpack version major equals 3', () => {
    jest.mock('../../lib/util/packageVersion', () => ({
      packageVersion: () => ({ major: 3 }),
    }));

    const webpack = require('../../lib/webpack');

    expect(webpack).toEqual({ version: 3 });
  });

  it('should return udk/lib/webpack.v4 when webpack version major equals 4', () => {
    jest.mock('../../lib/util/packageVersion', () => ({
      packageVersion: () => ({ major: 4 }),
    }));

    const webpack = require('../../lib/webpack');

    expect(webpack).toEqual({ version: 4 });
  });
});
