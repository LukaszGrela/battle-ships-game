import globals from "globals";
import { config as baseConfig } from "./base.js";

/**
 * ESLint configuration for Node.js backend applications (`apps/server`).
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    rules: {
      "no-console": "off", // Allowed for server logging
    },
  },
];
