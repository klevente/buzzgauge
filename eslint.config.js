// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import reactPlugin from "eslint-plugin-react";
import unicornPlugin from "eslint-plugin-unicorn";
import globals from "globals";

export default tseslint.config(
  {
    // These files are auto-generated, so we should not do linting on them
    ignores: [".react-router/", "app/components/ui/"],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    languageOptions: {
      parserOptions: {
        parser: "@typescript-eslint/parser",
        projectService: {
          allowDefaultProject: ["eslint.config.js", "prettier.config.js"],
        },
      },
    },
  },
  unicornPlugin.configs["flat/recommended"],
  {
    files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat["jsx-runtime"],
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      ...reactPlugin.configs.flat["jsx-runtime"].languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "no-empty-pattern": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  prettierConfig,
);
