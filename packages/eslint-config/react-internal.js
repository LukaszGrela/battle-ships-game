import eslintConfigPrettier from "eslint-config-prettier";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { config as baseConfig } from "./base.js";

/**
 * ESLint configuration for React frontend applications and UI packages.
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...baseConfig,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
