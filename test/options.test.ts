import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scriptRunsCommand } from "../src/commands.js";
import { parsePolicy, PolicyError } from "../src/policy.js";
import { sameOptions } from "../src/severity.js";

describe("options", () => {
  it("matches option objects regardless of key order", () => {
    assert.equal(sameOptions([{ paths: ["db"], patterns: [] }], [{ patterns: [], paths: ["db"] }]), true);
    assert.equal(sameOptions([{ paths: ["db"] }], [{ paths: [] }]), false);
  });

  it("keeps a recorded options array and rejects a non-array", () => {
    const policy = parsePolicy({
      version: 1,
      rules: [{ id: "no-console", minSeverity: "error", globs: ["src/**/*.ts"], options: [{ allow: ["warn"] }] }],
    });
    assert.deepEqual(policy.rules[0]?.options, [{ allow: ["warn"] }]);
    assert.throws(
      () =>
        parsePolicy({
          version: 1,
          rules: [{ id: "no-console", minSeverity: "error", globs: ["src/**/*.ts"], options: "locked" }],
        }),
      PolicyError,
    );
  });
});

describe("lint script command", () => {
  it("accepts a command token and rejects an echo mention", () => {
    assert.equal(scriptRunsCommand("eslint .", "eslint"), true);
    assert.equal(scriptRunsCommand("npx eslint .", "eslint"), true);
    assert.equal(scriptRunsCommand("node_modules/.bin/eslint .", "eslint"), true);
    assert.equal(scriptRunsCommand("echo eslint", "eslint"), false);
    assert.equal(scriptRunsCommand("echo eslint && eslint .", "eslint"), true);
  });
});
