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
      // Document the parameter, not each of its fields — the type already
      // names them, and one tag per sub-property is noise.
      'jsdoc/require-param': ['warn', { checkDestructured: false }],
      'jsdoc/check-param-names': ['warn', { checkDestructured: false }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Components still need a doc comment saying what they are for, but
    // "@param props.className the class name" is the noise CLAUDE.md warns
    // against — the prop types already say it, and the destructured shape
    // makes jsdoc demand one tag per prop.
    files: ['**/*.tsx'],
    rules: {
      'jsdoc/require-returns': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/check-param-names': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'jsdoc/require-jsdoc': 'off' },
  }
);
