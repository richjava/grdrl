import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCase, listCaseIds, renderCoverage } from "./corpus.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const results = [];
for (const caseId of listCaseIds()) {
  results.push(await evaluateCase(caseId));
}

const mismatches = results.filter(
  (result) =>
    result.actual.configHash !== result.configHash ||
    result.actual.storedHash !== result.storedHash ||
    result.actual.semantic !== result.semantic ||
    result.actual.trustedPolicy !== result.trustedPolicy,
);

const docsDir = path.join(root, "docs");
mkdirSync(docsDir, { recursive: true });
writeFileSync(path.join(docsDir, "bypass-coverage.md"), renderCoverage(results));

if (mismatches.length > 0) {
  for (const mismatch of mismatches) {
    process.stderr.write(
      `${mismatch.id}\nexpected ${JSON.stringify({
        configHash: mismatch.configHash,
        storedHash: mismatch.storedHash,
        semantic: mismatch.semantic,
        trustedPolicy: mismatch.trustedPolicy,
      })}\nactual ${JSON.stringify(mismatch.actual)}\nsemantic ${mismatch.semanticViolations.join(" | ")}\ntrusted ${mismatch.trustedViolations.join(" | ")}\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(`Wrote docs/bypass-coverage.md (${results.length} cases).\n`);
