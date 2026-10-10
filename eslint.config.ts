import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import playwright from 'eslint-plugin-playwright';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const USE_DATE_UTILS = 'Dates and time go through @utils/date.';

export default defineConfig(
  globalIgnores(['playwright-report/', 'test-results/', 'blob-report/', '.auth/', '.tools/']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    // Type-aware rules; each file uses its nearest tsconfig (k6/ has its own).
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Numbers in messages and URLs are fine; objects and unions are still caught.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Playwright fixture maps must be `type`s (an interface has no index signature).
      '@typescript-eslint/consistent-type-definitions': 'off',
      // Playwright fixtures with no dependencies are written `async ({}, use) => …`.
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },
  // One place for date formats and the clock: only src/utils/date.ts uses date-fns or `Date`.
  {
    ignores: ['src/utils/date.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'date-fns', message: USE_DATE_UTILS }],
          patterns: [{ group: ['date-fns/*'], message: USE_DATE_UTILS }],
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: USE_DATE_UTILS },
        { selector: "MemberExpression[object.name='Date'][property.name='now']", message: USE_DATE_UTILS },
      ],
    },
  },
  // Specs, page objects and fixtures: missing awaits, hard waits, force clicks, page.pause().
  { files: ['tests/**/*.ts', 'src/**/*.ts'], extends: [playwright.configs['flat/recommended']] },
  prettier, // last: turns off rules that clash with Prettier
);
