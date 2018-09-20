// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

export function decorateEventListener(
  emitter: any, // tslint:disable-line:no-any
  eventName: string,
  decorator: (...args: any[]) => void, // tslint:disable-line:no-any
) {
  const listener = emitter._events && emitter._events[eventName];

  if (!listener) {
    return;
  }

  const decoratorHandler = (...args: any[]) => { // tslint:disable-line:no-any
    const next = (err?: Error) => {
      if (err) {
        throw err;
      }

      if (Array.isArray(listener)) {
        listener.forEach(_listener => _listener(...args));
      } else {
        listener(...args);
      }
    };

    decorator(...args, next);
  };

  emitter._events[eventName] = decoratorHandler;

  return decoratorHandler;
}
