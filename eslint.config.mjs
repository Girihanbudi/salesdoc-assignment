import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-types/**',
      '**/node_modules/**',
      '**/coverage/**',
      // Plain JS hook scripts vendored from the scaffold. They carry JSDoc
      // *types*, which is correct for untyped .mjs but trips the TypeScript
      // jsdoc preset.
      '.claude/scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsdoc.configs['flat/recommended-typescript'],
  {
    rules: {
      // TypeScript already resolves globals and undefined identifiers, and
      // no-undef doesn't understand TS scope. Leaving it on produces false
      // positives on `process` and `console` in perfectly valid Node code.
      'no-undef': 'off',

      // Documentation rides the lint rail, so undocumented exports bounce back
      // through the existing PostToolUse hook instead of needing a separate gate.
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: ['TSInterfaceDeclaration'],
        },
      ],
      // Types here are `z.infer` aliases sitting directly under a documented
      // schema. Requiring a second doc comment would only duplicate the first.
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/tag-lines': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // A React component returning JSX gains nothing from "@returns the JSX".
    files: ['**/*.tsx'],
    rules: { 'jsdoc/require-returns': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'jsdoc/require-jsdoc': 'off' },
  }
);
