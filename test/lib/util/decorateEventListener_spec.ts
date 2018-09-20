// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import { decorateEventListener } from '../../../lib/util/decorateEventListener';

describe('udk/lib/util/decorateEventListener', () => {
  describe('decorateEventListener', () => {
    it('should decorate event listener if it exists in emitter', () => {
      const fooListener = jest.fn();
       // tslint:disable-next-line:no-any
      const emitter = { _events: { foo: undefined as any as (...args: any[]) => void } };
      const decorator = (...args: any[]) => { // tslint:disable-line:no-any
        const next = args.pop();
        next();
      };

      decorateEventListener(emitter, 'foo', decorator);

      expect(emitter._events.foo).toBeFalsy();

      emitter._events.foo = fooListener as any; // tslint:disable-line:no-any

      decorateEventListener(emitter, 'foo', decorator);

      expect(emitter._events.foo).not.toBe(fooListener);

      emitter._events.foo('foo', 'bar');

      expect(fooListener).toBeCalledWith('foo', 'bar');

      emitter._events.foo = [ fooListener ] as any; // tslint:disable-line:no-any

      decorateEventListener(emitter, 'foo', decorator);

      emitter._events.foo('foo', 'bar');

      expect(fooListener).toBeCalledWith('foo', 'bar');

      emitter._events.foo = [ fooListener ] as any; // tslint:disable-line:no-any

      decorateEventListener(emitter, 'foo', decorator);

      emitter._events.foo('foo', 'bar');

      decorateEventListener(emitter, 'foo', (...args: any[]) => { // tslint:disable-line:no-any
        const next = args.pop();
        next(new Error('fake error'));
      });

      expect(() => emitter._events.foo('foo', 'bar'))
        .toThrowError('fake error');
    });
  });
});
