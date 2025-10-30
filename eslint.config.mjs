import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  // Ignore build artifacts and non-source helpers
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      'node_modules/**',
      'components.json',
      'electron/**',
      'lib/**',
      'scripts/**'
    ]
  },

  // JS recommended baseline
  js.configs.recommended,

  // Lightweight TypeScript + React config (no project-based type-check parsing)
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      import: importPlugin
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { project: './tsconfig.base.json' },
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] }
      }
    },
    rules: {
      // Keep a small, practical set of rules. Reintroduce stricter type-checked rules later.
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'object', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [{ pattern: '@workspace/shared/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin']
        }
      ],
      'import/no-default-export': 'error',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]
    }
  },

  // API server: Node environment and allow default exports
  {
    files: ['apps/api/**/*.{ts,tsx,js}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'import/no-default-export': 'off' }
  },

  // Web: Browser globals
  {
    files: ['apps/web/**/*.{ts,tsx,jsx}'],
    languageOptions: { globals: { ...globals.browser } }
  },

  // Allow default exports for build/config scripts where required by the tool.
  {
    files: ['**/vite.config.{js,ts}', '**/tailwind.config.{js,ts}', '**/postcss.config.{js,ts}'],
    rules: { 'import/no-default-export': 'off' }
  },

  // UI helpers may use loose typing (third-party wrappers) — opt out of a couple strict rules here
  {
    files: ['apps/web/src/components/ui/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off'
    }
  },

  // Tests and declaration files
  {
    files: ['**/__tests__/**/*.{ts,tsx,js}', '**/*.test.{ts,tsx,js}', '**/*.spec.{ts,tsx,js}'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off', '@typescript-eslint/no-unsafe-call': 'off', '@typescript-eslint/no-unsafe-member-access': 'off' }
  },
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/consistent-type-imports': 'off', 'import/no-default-export': 'off' }
  }
];
