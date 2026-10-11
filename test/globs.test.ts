import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesGlob } from "../src/files.js";
import { globsCovering } from "../src/globs.js";

describe("globsCovering", () => {
  it("covers every enabled file", () => {
    const patterns = globsCovering(["src/index.ts", "src/app/page.ts"], []);
    assert.ok(patterns.some((pattern) => matchesGlob("src/index.ts", pattern)));
    assert.ok(patterns.some((pattern) => matchesGlob("src/app/page.ts", pattern)));
  });

  it("leaves a file where the rule is off outside the glob", () => {
    const patterns = globsCovering(["src/index.ts"], ["src/app/page.ts"]);
    assert.ok(patterns.some((pattern) => matchesGlob("src/index.ts", pattern)));
    assert.equal(
      patterns.some((pattern) => matchesGlob("src/app/page.ts", pattern)),
      false,
    );
  });
});
