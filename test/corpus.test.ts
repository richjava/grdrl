import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateCase, listCaseIds } from "../scripts/corpus.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("bypass corpus", () => {
  it("covers 27 cases", () => {
    assert.equal(listCaseIds().length, 27);
  });

  it("records the measured results in docs/bypass-coverage.md", () => {
    const doc = readFileSync(path.join(root, "docs", "bypass-coverage.md"), "utf8");
    for (const caseId of listCaseIds()) {
      const expected = JSON.parse(readFileSync(path.join(root, "fixtures", "cases", caseId, "expected.json"), "utf8")) as {
        semantic: string;
        trustedPolicy: string;
      };
      const row = doc.split("\n").find((line) => line.startsWith(`| ${caseId} |`));
      assert.ok(row, `${caseId} is missing from the coverage doc`);
      assert.match(row, new RegExp(`\\| ${expected.semantic} \\| ${expected.trustedPolicy} \\|$`));
    }
  });

  for (const caseId of listCaseIds()) {
    it(caseId, async () => {
      const result = await evaluateCase(caseId);
      assert.deepEqual(result.actual, {
        configHash: result.configHash,
        storedHash: result.storedHash,
        semantic: result.semantic,
        trustedPolicy: result.trustedPolicy,
      }, `${result.semanticViolations.join("\n")}\n--- trusted ---\n${result.trustedViolations.join("\n")}`);
    });
  }
});
