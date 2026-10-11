export default [
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: ["db"] }],
      "no-console": "warn",
    },
  },
  {
    files: ["src/app/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
