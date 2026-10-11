import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exceptionCovers } from "../src/exceptions.js";
import { matchesGlob } from "../src/files.js";
import { parsePolicy, PolicyError } from "../src/policy.js";
import { severityRank } from "../src/severity.js";
import { findSuppressions } from "../src/suppressions.js";

describe("severity", () => {
  it("ranks eslint rule values", () => {
    assert.equal(severityRank("off"), 0);
    assert.equal(severityRank(["warn", { paths: [] }]), 1);
    assert.equal(severityRank(["error", { paths: ["db"] }]), 2);
    assert.equal(severityRank(undefined), 0);
  });
});

describe("globs", () => {
  it("matches files directly under a double-star glob", () => {
    assert.equal(matchesGlob("src/index.ts", "src/**/*.ts"), true);
    assert.equal(matchesGlob("src/app/page.ts", "src/**/*.ts"), true);
    assert.equal(matchesGlob("test/index.ts", "src/**/*.ts"), false);
  });
});

describe("suppressions", () => {
  it("parses blanket disables, named disables, and typescript suppressions", () => {
    const found = findSuppressions(
      [
        'const label = "eslint-disable-next-line";',
        "/* eslint-disable */",
        "// eslint-disable-next-line no-console",
        "// @ts-nocheck",
        "// @ts-ignore",
      ].join("\n"),
    );
    assert.deepEqual(
      found.map((item) => `${item.directive}:${item.ruleId}`),
      ["eslint-disable:*", "eslint-disable-next-line:no-console", "@ts-nocheck:@ts-nocheck", "@ts-ignore:@ts-ignore"],
    );
  });
});

describe("exceptions", () => {
  it("ignores blank reasons and expired dates", () => {
    const exceptions = [
      { ruleId: "no-console", file: "src/a.ts", reason: "   ", expires: "2099-01-01" },
      { ruleId: "no-console", file: "src/b.ts", reason: "needed", expires: "2020-01-01" },
      { ruleId: "*", file: "src/c.ts", reason: "blanket", expires: "2099-01-01" },
    ];
    assert.equal(exceptionCovers(exceptions, "src/a.ts", "no-console", "2026-10-10"), false);
    assert.equal(exceptionCovers(exceptions, "src/b.ts", "no-console", "2026-10-10"), false);
    assert.equal(exceptionCovers(exceptions, "src/c.ts", "no-console", "2026-10-10"), true);
    assert.equal(exceptionCovers(exceptions, "src/b.ts", "no-console", "2019-01-01"), true);
  });
});

describe("policy", () => {
  it("rejects a manifest that freezes nothing useful without a version", () => {
    assert.throws(() => parsePolicy({ rules: [] }), PolicyError);
  });
});
