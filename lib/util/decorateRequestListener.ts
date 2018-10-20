// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as http from 'http';

import { decorateEventListener } from './decorateEventListener';

export function decorateRequestListener(
  emitter: any, // tslint:disable-line:no-any
  decorator: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: (err?: Error) => void,
  ) => void,
) {
  return decorateEventListener(emitter, 'request', (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: (err?: Error) => void,
  ) => {
    const onError = (err: Error) => {
      res.statusCode = 500;
      res.statusMessage = http.STATUS_CODES['500'] as string;
      res.write(err.stack || err.message);
      res.end();
    };

    try {
      decorator(req, res, (err?: Error) => {
        if (err) {
          onError(err);
        } else {
          next();
        }
      });
    } catch (err) {
      onError(err);
    }
  });
}
