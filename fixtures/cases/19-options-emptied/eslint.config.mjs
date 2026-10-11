export default [
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [] }],
      "no-console": "warn",
    },
  },
];
