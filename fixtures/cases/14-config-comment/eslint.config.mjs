// Formatter touched this file. Enforcement is unchanged.
export default [
  {
    files: ["**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: ["db"] }],
      "no-console": "warn",
    },
  },
];
