module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  globals: {
    process: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:node/recommended",
    "plugin:promise/recommended",
    "plugin:import/recommended",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "commonjs",
  },
  rules: {
    "no-undef": ["error", { globals: { process: true } }],
    "handle-callback-err": "error",
    "no-console": "warn",
    "no-unused-vars": "warn",
    "node/no-unpublished-require": "off",
    "import/no-unresolved": "off",
    "import/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index",
        ],
        "newlines-between": "always",
      },
    ],
  },
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js"],
      },
    },
  },
};
