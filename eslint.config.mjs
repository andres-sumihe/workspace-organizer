import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const enrichTypeScriptConfig = (config) => ({
  ...config,
  files: config.files ?? ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
  languageOptions: {
    ...config.languageOptions,
    parser: tsParser,
    parserOptions: {
      projectService: true,
      tsconfigRootDir: __dirname,
      ecmaFeatures: { jsx: true },
      sourceType: "module",
      ...config.languageOptions?.parserOptions
    }
  },
  plugins: {
    ...config.plugins,
    "@typescript-eslint": tsPlugin
  }
});

const tsTypeCheckedConfigs = (tsPlugin.configs["flat/recommended-type-checked"] ?? []).map(enrichTypeScriptConfig);

const tsStylisticConfigs = (tsPlugin.configs["flat/stylistic-type-checked"] ?? []).map(enrichTypeScriptConfig);

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "node_modules/**",
      "src/**",
      "components.json"
    ]
  },
  {
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  js.configs.recommended,
  ...tsTypeCheckedConfigs,
  ...tsStylisticConfigs,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  {
  files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      },
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      import: importPlugin
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.base.json"
        },
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"]
        }
      }
    },
    rules: {
      ...jsxA11yPlugin.configs.recommended.rules,
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
            "object",
            "type"
          ],
          alphabetize: { order: "asc", caseInsensitive: true },
          "newlines-between": "always",
          pathGroups: [
            {
              pattern: "@workspace/shared/**",
              group: "internal"
            }
          ],
          pathGroupsExcludedImportTypes: ["builtin"]
        }
      ],
      "import/no-default-export": "error",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports"
        }
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false
          }
        }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    files: ["apps/api/**/*.{ts,tsx,js}"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "import/no-default-export": "off"
    }
  },
  {
    files: ["apps/web/**/*.{ts,tsx,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: ["apps/web/src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off"
    }
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "import/no-default-export": "off"
    }
  },
  {
    files: [
      "**/tailwind.config.{js,ts}",
      "**/vite.config.{js,ts}",
      "**/postcss.config.{js,ts}"
    ],
    rules: {
      "import/no-default-export": "off"
    }
  }
];
