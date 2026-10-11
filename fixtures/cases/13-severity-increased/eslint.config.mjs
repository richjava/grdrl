export default [
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: ["db"] }],
      "no-console": "error",
    },
  },
];
