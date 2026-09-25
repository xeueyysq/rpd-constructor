import path from "node:path";
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import query from "@tanstack/eslint-plugin-query";
import prettierConfig from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import prettier from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

const root = import.meta.dirname;
const layers = ["shared", "entities", "features", "widgets", "pages", "app"];
const slices = ["entities", "features", "widgets", "pages"];
const lowerLayers = (layer) => layers.slice(0, layers.indexOf(layer));
const publicApi = { fileInternalPath: "index.{ts,tsx}" };

export default [
  {
    ignores: ["dist/**", "node_modules/**", "fsd-high-level-dependencies.html"],
  },
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["src/**/*.{ts,tsx}", "*.{ts,tsx}"],
  })),
  {
    files: ["src/**/*.{ts,tsx}", "*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.browser, ...globals.es2020 },
    },
    plugins: { boundaries, prettier, "react-hooks": reactHooks, "react-refresh": reactRefresh },
    settings: {
      "boundaries/root-path": root,
      "boundaries/legacy-templates": false,
      "boundaries/elements": [
        { type: "shared", pattern: "src/shared" },
        ...slices.map((layer) => ({
          type: layer,
          pattern: `src/${layer}/*`,
          capture: ["slice"],
        })),
        { type: "app", pattern: "src/app" },
      ],
      "import/resolver": {
        typescript: {
          project: path.join(root, "tsconfig.json"),
          alias: Object.fromEntries(
            layers.map((layer) => [`@${layer}`, [path.join(root, "src", layer)]]),
          ),
          extensions: [".ts", ".tsx", ".js", ".jsx"],
        },
      },
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-hooks/exhaustive-deps": "off",
      // ponytail: 27 старых нарушений; включаем по мере рефакторинга компонентов.
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "prettier/prettier": ["error", { endOfLine: "auto", tabWidth: 2, printWidth: 80 }],
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: layers.filter((layer) => lowerLayers(layer).length).map((layer) => ({
            from: { element: { type: layer } },
            allow: {
              to: lowerLayers(layer).map((target) => ({
                element: slices.includes(target)
                  ? { type: target, ...publicApi }
                  : { type: target },
              })),
            },
          })),
        },
      ],
    },
  },
  ...query.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["src/**/*.{ts,tsx}"],
  })),
  {
    files: ["src/{shared,entities,features,widgets,pages,app}/**/*.{ts,tsx}"],
    rules: { "boundaries/no-unknown-files": "error" },
  },
  prettierConfig,
];
