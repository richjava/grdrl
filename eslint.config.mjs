import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "fixtures/**", ".tmp/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      "no-console": "error",
    },
  },
];
