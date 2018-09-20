// Type definitions for yargs-parser@10.1.0
// Project: https://github.com/yargs/yargs-parser
// Definitions by: Steven Enten <steven@enten.fr>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.7.2

declare module 'yargs-parser' {
  export = yargs;
}

declare function yargs(args: string | string[], opts?: yargs.Options): yargs.ArgsParsed;

declare namespace yargs {
  /** an object representing the parsed value of args. */
  interface ArgsParsed {
    /** an array representing the positional arguments. */
    '_': string[];
    /** an array with arguments after the end-of-options flag `--`. */
    '--': string[];
    /** key value pairs for each argument and their aliases. */
    [key: string]: any;
  }

  /** detailed information required by the yargs engine. */
  interface ArgsParsedDetailed {
    /** an object representing the parsed value of args. */
    argv: ArgsParsed;
    /** populated with an error object if an exception occurred during parsing. */
    error: Error | null;
    /** the inferred list of aliases built by combining lists in opts.alias. */
    aliases: string[];
    /** any new aliases added via camel-case expansion. */
    newAliases: string[];
    /** the configuration loaded from the yargs stanza in package.json. */
    configuration: Configuration;
  }

  interface Configuration {
    /** Should a group of short-options be treated as boolean flags? (default: true) */
    'short-option-groups'?: boolean;
    /** Should hyphenated arguments be expanded into camel-case aliases? (default: true) */
    'camel-case-expansion'?: boolean;
    /** Should keys that contain . be treated as objects? (default: true) */
    'dot-notation'?: boolean;
    /** Should keys that look like numbers be treated as such? (default: true) */
    'parse-numbers'?: boolean;
    /** Should variables prefixed with --no be treated as negations? (default: true) */
    'boolean-negation'?: boolean;
    /** Should arrays be combined when provided by both command line arguments and a configuration file. (default: false) */
    'combine-arrays'?: boolean;
    /** Should arguments be coerced into an array when duplicated. (default: true) */
    'duplicate-arguments-array'?: boolean;
    /** Should array arguments be coerced into a single array when duplicated. (default: true) */
    'flatten-duplicate-arrays'?: boolean;
    /** The prefix to use for negated boolean variables. (default: "no-") */
    'negation-prefix'?: string;
    /** Should unparsed flags be stored in -- or _. (default: false) */
    'populate--'?: boolean;
    /** Should a placeholder be added for keys not set via the corresponding CLI argument? (default: false) */
    'set-placeholder-key'?: boolean;
  }

  interface Options {
    /** an object representing the set of aliases for a key */
    alias?: { [key: string]: string | string[] };
    /** indicate that keys should be parsed as an array */
    array?: string | string[];
    /** arguments should be parsed as booleans */
    boolean?: string | string[];
    /** indicate a key that represents a path to a configuration file (this file will be loaded and parsed). */
    config?: string | string[] | Configuration;
    /** provide a custom synchronous function that returns a coerced value from the argument provided (or throws an error) */
    coerce?: { [key: string]: (arg: any) => any };
    /** indicate a key that should be used as a counter. */
    count?: string | string[];
    /** provide default values for keys */
    default?: { [key: string]: any };
    /** environment variables (`process.env`) with the prefix provided should be parsed. */
    envPrefix?: string;
    /** specify that a key requires n arguments */
    narg?: { [key: string]: number };
    /** path.normalize() will be applied to values set to this key. */
    normalize?: (path: string) => string;
    /** keys should be treated as strings (even if they resemble a number `-x 33`) */
    string?: string | string[];
    /** provide configuration options to the yargs-parser */
    configuration?: Configuration;
    /** keys should be treated as numbers */
    number?: string | string[];
    /** arguments after the end-of-options flag -- will be set to the argv.['--'] array instead of being set to the argv._ array. */
    '--'?: boolean;
  }

  function detailed(args: string | string[], opts?: Options): ArgsParsedDetailed;
}
