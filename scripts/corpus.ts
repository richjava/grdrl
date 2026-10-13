import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkProject } from "../src/check.js";
import { hashFile } from "../src/hash.js";
import { loadExceptionsFile, loadPolicyFile } from "../src/policy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const baselineDir = path.join(root, "fixtures", "baseline");
export const casesDir = path.join(root, "fixtures", "cases");
export const corpusToday = "2026-10-10";

export type Expectation = {
  description: string;
  intent: "bypass" | "legitimate";
  configHash: "flag" | "pass";
  storedHash: "flag" | "pass";
  semantic: "fail" | "pass";
  trustedPolicy: "fail" | "pass";
  rewriteStoredHash?: boolean;
  note: string;
};

export type CaseResult = Expectation & {
  id: string;
  actual: {
    configHash: "flag" | "pass";
    storedHash: "flag" | "pass";
    semantic: "fail" | "pass";
    trustedPolicy: "fail" | "pass";
  };
  semanticViolations: string[];
  trustedViolations: string[];
};

export function listCaseIds(): string[] {
  return readdirSync(casesDir)
    .filter((name) => statSync(path.join(casesDir, name)).isDirectory())
    .sort();
}

export function materialize(caseId: string): string {
  const scratch = path.join(root, ".tmp");
  mkdirSync(scratch, { recursive: true });
  const dest = mkdtempSync(path.join(scratch, "grdrl-"));
  cpSync(baselineDir, dest, { recursive: true });
  const caseDir = path.join(casesDir, caseId);
  copyOverlay(caseDir, caseDir, dest);
  const deleteList = path.join(caseDir, "delete.txt");
  try {
    const lines = readFileSync(deleteList, "utf8").split("\n");
    for (const line of lines) {
      const relative = line.trim();
      if (relative.length === 0) {
        continue;
      }
      unlinkSync(path.join(dest, relative));
    }
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
  }
  return dest;
}

export async function evaluateCase(caseId: string): Promise<CaseResult> {
  const expected = JSON.parse(readFileSync(path.join(casesDir, caseId, "expected.json"), "utf8")) as Expectation;
  const dest = materialize(caseId);
  try {
    const baselineConfig = hashFile(path.join(baselineDir, "eslint.config.mjs"));
    const currentConfig = hashFile(path.join(dest, "eslint.config.mjs"));
    const configHash = currentConfig !== baselineConfig ? "flag" : "pass";
    const storedRecord = expected.rewriteStoredHash ? currentConfig : baselineConfig;
    const storedHash = currentConfig !== storedRecord ? "flag" : "pass";
    const exceptions = readExceptions(dest);
    const semantic = await checkProject({
      cwd: dest,
      policy: loadPolicyFile(path.join(dest, "grdrl.json")),
      exceptions,
      today: corpusToday,
    });
    const trustedPath = path.join(casesDir, caseId, "base-policy.json");
    const trusted = await checkProject({
      cwd: dest,
      policy: loadPolicyFile(existsSync(trustedPath) ? trustedPath : path.join(baselineDir, "grdrl.json")),
      exceptions,
      today: corpusToday,
    });
    return {
      id: caseId,
      ...expected,
      actual: {
        configHash,
        storedHash,
        semantic: semantic.status === "failed" ? "fail" : "pass",
        trustedPolicy: trusted.status === "failed" ? "fail" : "pass",
      },
      semanticViolations: semantic.violations.map((violation) => `${violation.kind} ${violation.file} ${violation.message}`),
      trustedViolations: trusted.violations.map((violation) => `${violation.kind} ${violation.file} ${violation.message}`),
    };
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
}

export function renderCoverage(results: readonly CaseResult[]): string {
  const lines = [
    "# Bypass coverage",
    "",
    "Spec for the first checker. Each case overlays [fixtures/baseline](../fixtures/baseline). `npm test` fails when a result drifts from `expected.json`.",
    "",
    "Config hash is the SHA-256 of `eslint.config.mjs` compared with the baseline file. Stored hash is that same comparison, except `20-rewritten-checksum`, which rewrites the in-repo checksum to the new bytes before comparing. Semantic uses the case's own `grdrl.json`. Trusted policy uses the baseline `grdrl.json`, which is what `grdrl check --policy-ref <base>` loads.",
    "",
    "| Case | Intent | Config hash | Stored hash | Semantic | Trusted policy |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  for (const result of results) {
    lines.push(
      `| ${result.id} | ${result.intent} | ${result.actual.configHash} | ${result.actual.storedHash} | ${result.actual.semantic} | ${result.actual.trustedPolicy} |`,
    );
  }

  lines.push("", "## Notes", "");
  for (const result of results) {
    lines.push(`- **${result.id}** (${result.intent}): ${result.description} ${result.note}`);
  }
  lines.push(
    "",
    "A removed workflow is a semantic failure when this checker still runs. If the pull request deletes the job and nothing reports the required status check, merge protection is the control that blocks it.",
    "",
  );
  return lines.join("\n");
}

function copyFile(from: string, dest: string): void {
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(from, dest);
}

function copyOverlay(caseDir: string, current: string, destRoot: string): void {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === "expected.json" || entry.name === "delete.txt" || entry.name === "base-policy.json") {
      continue;
    }
    const from = path.join(current, entry.name);
    if (entry.isFile() && entry.name === "policy.json") {
      copyFile(from, path.join(destRoot, "grdrl.json"));
      continue;
    }
    if (entry.isFile() && entry.name === "flat-config.mjs") {
      copyFile(from, path.join(destRoot, "eslint.config.mjs"));
      continue;
    }
    if (entry.isFile() && entry.name === "workflow.yml") {
      copyFile(from, path.join(destRoot, ".github", "workflows", "ci.yml"));
      continue;
    }
    if (entry.isFile() && entry.name === "exceptions.json") {
      copyFile(from, path.join(destRoot, "grdrl.exceptions.json"));
      continue;
    }
    const relative = path.relative(caseDir, from);
    const dest = path.join(destRoot, relative);
    if (entry.isDirectory()) {
      mkdirSync(dest, { recursive: true });
      copyOverlay(caseDir, from, destRoot);
      continue;
    }
    if (entry.isFile()) {
      mkdirSync(path.dirname(dest), { recursive: true });
      cpSync(from, dest);
    }
  }
}

function readExceptions(cwd: string) {
  const filePath = path.join(cwd, "grdrl.exceptions.json");
  try {
    return loadExceptionsFile(filePath);
  } catch (error) {
    if (isEnoent(error) || (error instanceof Error && error.message.includes("ENOENT"))) {
      return [];
    }
    throw error;
  }
}

function isEnoent(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
