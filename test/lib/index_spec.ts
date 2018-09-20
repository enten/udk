// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

jest.mock('../../lib/webpack', () => ({ version: NaN }));

afterAll(() => {
  jest.unmock('../../lib/webpack');
});

describe('udk/lib/index', () => {
  it('should return udk/lib/webpack', () => {
    const udk = require('../../lib/index');

    expect(udk).toEqual({ version: NaN });
  });
});
