// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

describe('udk/bin/udk-webpack', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.unmock('../../lib/util/packageVersion');
    jest.unmock('../../bin/udk-webpack3');
    jest.unmock('../../bin/udk-webpack4');
  });

  it('should require udk/bin/udk-webpack3 when webpack version major equals 3', () => {
    jest.mock('../../bin/udk-webpack3', () => ({ version: 3 }));
    jest.mock('../../bin/udk-webpack4', () => { throw new Error('failure'); });

    jest.mock('../../lib/util/packageVersion', () => ({
      packageVersion: () => ({ major: 3 }),
    }));

    require('../../bin/udk-webpack');
  });

  it('should require udk/bin/udk-webpack4 when webpack version major equals 4', () => {
    jest.mock('../../bin/udk-webpack3', () => { throw new Error('failure'); });
    jest.mock('../../bin/udk-webpack4', () => ({ version: 4 }));

    jest.mock('../../lib/util/packageVersion', () => ({
      packageVersion: () => ({ major: 4 }),
    }));

    require('../../bin/udk-webpack');
  });
});
