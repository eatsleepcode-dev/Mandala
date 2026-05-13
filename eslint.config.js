// ---
// file: eslint.config.js
// description: ESLint 9 flat config for Mandala VS Code extension
// scope: lint gate — enforces TypeScript/React rules across src/
// ---

import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'out/**'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    // Test files use require() for Jest mocks — downgrade to warning only
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/__mocks__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'warn',
    },
  },
];
