import globals from "globals";
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const files = ["**/*.ts"];

export default [
  { ignores: ["node_modules/**", "dist/**", "build/**"] },
  { ...js.configs.recommended, files },
  ...tsPlugin.configs["flat/recommended"].map((config) => ({ ...config, files })),
  {
    files,
    languageOptions: { parser: tsParser, sourceType: "module", globals: globals.node },
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
];
