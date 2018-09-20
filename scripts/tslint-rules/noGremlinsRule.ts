// Copyright (c) 2018 Steven Enten. All rights reserved. Licensed under the MIT license.

import * as Lint from 'tslint'; // tslint:disable-line: no-implicit-dependencies
import * as ts from 'typescript'; // tslint:disable-line: no-implicit-dependencies


export interface Gremlin {
  description: string;
  fixChar: string;
  hexCodePoint: string;
  zeroWidth?: boolean;
}

export const charFromHex = (hexCodePoint: string) => String.fromCodePoint(+`0x${hexCodePoint}`);

export const gremlinsConfig: { [key: string]: Gremlin } = {
  [charFromHex('200b')]: {
    description: 'zero width space',
    fixChar: '',
    hexCodePoint: '200b',
    zeroWidth: true,
  },
  [charFromHex('00a0')]: {
    description: 'non breaking space',
    fixChar: ' ',
    hexCodePoint: '00a0',
  },
  [charFromHex('201c')]: {
    description: 'left double quotation mark',
    fixChar: '"',
    hexCodePoint: '201c',
  },
  [charFromHex('201d')]: {
    description: 'right double quotation mark',
    fixChar: '"',
    hexCodePoint: '201d',
  },
};

export const regexpWithAllChars = new RegExp(
  Object.keys(gremlinsConfig)
    .map(hexCodePoint => hexCodePoint + '+')
    .join('|'),
  'g',
);


export class Rule extends Lint.Rules.AbstractRule {
  public static metadata: Lint.IRuleMetadata = {
    ruleName: 'no-gremlins',
    type: 'style',
    description: `Ensure the file doesn't contain gremlins characters.`,
    options: null,
    optionsDescription: `No options.`,
    typescriptOnly: false,
  };

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    if (sourceFile.text.length === 0) {
      return [];
    }

    const failures: Lint.RuleFailure[] = [];
    const src = sourceFile.text;
    let match: RegExpExecArray | null;

    // tslint:disable-next-line: no-conditional-assignment
    while ((match = regexpWithAllChars.exec(src))) {
      const matchedCharacter = match[0][0];

      const gremlin = gremlinsConfig[matchedCharacter];
      const startPos = match.index;
      const endPos = match.index + match[0].length;

      const hoverMessage = match[0].length +
        ' ' +
        gremlin.description +
        (match[0].length > 1 ? 's' : '') +
        ' (unicode U+' +
        gremlin.hexCodePoint +
        ') here';

      const fix =  Lint.Replacement.replaceFromTo(
        startPos,
        endPos,
        gremlin.fixChar.repeat(match[0].length),
      );

      failures.push(new Lint.RuleFailure(
        sourceFile,
        startPos,
        endPos,
        hoverMessage,
        this.ruleName,
        fix,
      ));
    }

    return failures;
  }
}
