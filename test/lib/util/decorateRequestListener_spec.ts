// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as http from 'http';

import { decorateRequestListener } from '../../../lib/util/decorateRequestListener';

describe('udk/lib/util/decorateRequestListener', () => {
  describe('decorateRequestListener', () => {
    it('should call next when there is no error only', () => {
      const requestListener = jest.fn();
      const decorator = jest.fn();
      const req = {};
      const res = { statusCode: 200, statusMessage: 'OK', write: jest.fn(), end: jest.fn() };
      const emitter = {
        _events: {
          request: requestListener,
        },
      };

      decorateRequestListener(emitter, decorator);

      expect(emitter._events.request).not.toBe(requestListener);

      emitter._events.request(req, res);

      expect(decorator).toBeCalled();
      expect(decorator.mock.calls[0][0]).toBe(req);
      expect(decorator.mock.calls[0][1]).toBe(res);
      expect(typeof decorator.mock.calls[0][2]).toEqual('function');

      const fakeError = new Error('fake error');

      decorator.mockImplementation((
        req: http.IncomingMessage,
        res: http.OutgoingMessage,
        next: (err?: Error) => void,
      ) => {
        next(fakeError);
      });

      emitter._events.request(req, res);

      expect(res.end).toBeCalled();
      expect(res.statusCode).toEqual(500);
      expect(res.statusMessage).toEqual(http.STATUS_CODES['500']);
      expect(res.write).toBeCalledWith(fakeError.stack);

      res.end.mockClear();
      res.write.mockClear();

      decorator.mockImplementation((
        req: http.IncomingMessage,
        res: http.OutgoingMessage,
        next: (err?: Error) => void,
      ) => {
        throw { message: 'fake error' };
      });

      emitter._events.request(req, res);

      expect(res.end).toBeCalled();
      expect(res.statusCode).toEqual(500);
      expect(res.statusMessage).toEqual(http.STATUS_CODES['500']);
      expect(res.write).toBeCalledWith('fake error');

      res.end.mockClear();
      res.write.mockClear();

      decorator.mockImplementation((
        req: http.IncomingMessage,
        res: http.OutgoingMessage,
        next: (err?: Error) => void,
      ) => {
        next();
      });

      emitter._events.request(req, res);

      expect(requestListener).toBeCalled();
      expect(res.end).not.toBeCalled();
      expect(res.write).not.toBeCalled();
    });
  });
});
