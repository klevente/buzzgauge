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
    ignores: [
      "build/",
      ".react-router/",
      "app/components/ui/",
      "app/hooks/use-toast.ts",
    ],
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
    // @ts-expect-error https://github.com/jsx-eslint/eslint-plugin-react/issues/3878
    ...reactPlugin.configs.flat.recommended,
    // @ts-expect-error https://github.com/jsx-eslint/eslint-plugin-react/issues/3878
    ...reactPlugin.configs.flat["jsx-runtime"],
    languageOptions: {
      // @ts-expect-error https://github.com/jsx-eslint/eslint-plugin-react/issues/3878
      ...reactPlugin.configs.flat.recommended.languageOptions,
      // @ts-expect-error https://github.com/jsx-eslint/eslint-plugin-react/issues/3878
      ...reactPlugin.configs.flat["jsx-runtime"].languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  prettierConfig,
  {
    rules: {
      curly: ["error", "all"],
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
      "unicorn/prevent-abbreviations": [
        "error",
        {
          replacements: {
            props: false,
          },
        },
      ],
    },
  },
);
