export default [
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": ["warn", { paths: ["db"] }],
      "no-console": "warn",
    },
  },
];
