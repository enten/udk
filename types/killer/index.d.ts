// Type definitions for killer@0.1.0
// Project: https://www.npmjs.com/package/killer
// Definitions by: Steven Enten <steven@enten.fr>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.7.2

declare module 'killer' {
  export = killer;
}

declare function killer(options: killer.KillerOptions, callback?: () => void): void;

declare namespace killer {
  type KillerOptions = number | string | KillerOptionsObject;

  interface KillerOptionsObject {
    pid: number;
    timeout?: number;
    termSignal?: string;
    killSignal?: string;
    interval?: boolean | number;
  }
}
