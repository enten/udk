// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

describe('udk/bin/udk-dev-container', () => {
  afterEach(() => {
    jest.resetModuleRegistry();
    jest.unmock('../../lib/devContainer');
  });

  it('should run a devContainer', () => {
    jest.mock('../../lib/devContainer', () => ({
      default: () => ({ run: jest.fn() }),
    }));

    const udkc = require('../../bin/udk-dev-container');

    expect(udkc.run.mock.calls.length).toEqual(1);
  });

  it('should log error and exit when exception is thrown', () => {
    const originExit = process.exit;
    const originError = console.error;

    const exit = jest.fn();
    const error = jest.fn();

    process.exit = exit as Function as NodeJS.Process['exit'];
    console.error = error as Console['error'];

    jest.mock('../../lib/devContainer', () => ({
      default: () => ({ run: jest.fn(() => { throw new Error('fake error'); }) }),
    }));

    const udkc = require('../../bin/udk-dev-container');

    expect(udkc.run.mock.calls.length).toEqual(1);

    expect(exit.mock.calls.length).toEqual(1);
    expect(exit.mock.calls[0][0]).toEqual(99);

    expect(error.mock.calls.length).toEqual(1);
    expect(error.mock.calls[0][0].message).toEqual('fake error');

    process.exit = originExit;
    console.error = originError;
  });
});
