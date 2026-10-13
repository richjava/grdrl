import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { checkProject } from "../src/check.js";
import { loadPolicyFile } from "../src/policy.js";
import { materialize } from "../scripts/corpus.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "src", "cli.ts");
const scratch = path.join(root, ".tmp");

describe("check", () => {
  it("fails closed when flat config cannot be resolved", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "grdrl-missing-"));
    try {
      mkdirSync(path.join(cwd, "src"));
      writeFileSync(path.join(cwd, "src", "index.ts"), "export const ready = true;\n");
      const result = await checkProject({
        cwd,
        policy: {
          version: 1,
          rules: [{ id: "no-console", minSeverity: "error", globs: ["src/**/*.ts"] }],
        },
        today: "2026-10-10",
      });
      assert.equal(result.status, "failed");
      assert.equal(result.violations[0]?.kind, "config-unresolved");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports scope narrowing separately from a fully removed rule", async () => {
    const narrowed = materialize("04-scope-override");
    const removed = materialize("01-rule-deleted");
    try {
      const policy = loadPolicyFile(path.join(root, "fixtures", "baseline", "grdrl.json"));
      const scope = await checkProject({ cwd: narrowed, policy, today: "2026-10-10" });
      const deletion = await checkProject({ cwd: removed, policy, today: "2026-10-10" });
      assert.ok(scope.violations.some((violation) => violation.kind === "scope-narrowed" && violation.file === "src/app/page.ts"));
      assert.ok(deletion.violations.some((violation) => violation.kind === "rule-missing"));
    } finally {
      rmSync(narrowed, { recursive: true, force: true });
      rmSync(removed, { recursive: true, force: true });
    }
  });

  it("checks a matched mts file when the rule is off", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "grdrl-mts-"));
    try {
      mkdirSync(path.join(cwd, "src"));
      writeFileSync(path.join(cwd, "src", "index.mts"), "export const ready = true;\n");
      writeFileSync(
        path.join(cwd, "eslint.config.mjs"),
        'export default [{ files: ["**/*.mts"], rules: { "no-console": "off" } }];\n',
      );
      const result = await checkProject({
        cwd,
        policy: {
          version: 1,
          rules: [{ id: "no-console", minSeverity: "error", globs: ["src/**/*.mts"] }],
        },
        today: "2026-10-10",
      });
      assert.equal(result.status, "failed");
      assert.ok(result.violations.some((violation) => violation.kind === "rule-missing" && violation.file === "src/index.mts"));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("cli", () => {
  it("exits non-zero and prints json for a weakened fixture", () => {
    const cwd = materialize("02-severity-to-warn");
    try {
      const output = execFileSync("npx", ["tsx", cli, "check", "--cwd", cwd, "--format", "json"], {
        cwd: root,
        encoding: "utf8",
      });
      assert.fail(`expected failure, got ${output}`);
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      assert.equal(failure.status, 1);
      const report = JSON.parse(failure.stdout ?? "") as { status: string; violations: unknown[] };
      assert.equal(report.status, "failed");
      assert.ok(report.violations.length > 0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("loads the approved policy from a git ref", () => {
    mkdirSync(scratch, { recursive: true });
    const cwd = mkdtempSync(path.join(scratch, "grdrl-git-"));
    try {
      const baseline = path.join(root, "fixtures", "baseline");
      execFileSync("git", ["init", "-b", "main"], { cwd });
      copyFixture(baseline, cwd);
      gitCommit(cwd, "baseline");

      const weakened = materialize("12-manifest-and-rule-removed");
      copyFixture(weakened, cwd);
      rmSync(weakened, { recursive: true, force: true });

      const local = runCli(cwd, ["check", "--cwd", cwd, "--format", "json"]);
      assert.equal(local.status, 0);

      let trustedStatus = 0;
      try {
        runCli(cwd, ["check", "--cwd", cwd, "--policy-ref", "HEAD", "--format", "json"]);
      } catch (error) {
        trustedStatus = (error as { status?: number }).status ?? 0;
      }
      assert.equal(trustedStatus, 1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function copyFixture(from: string, to: string): void {
  execFileSync("cp", ["-R", `${from}/.`, to]);
}

function gitCommit(cwd: string, message: string): void {
  execFileSync("git", ["add", "."], { cwd });
  execFileSync("git", ["-c", "user.email=grdrl@example.com", "-c", "user.name=grdrl", "commit", "-m", message], { cwd });
}

function runCli(cwd: string, args: string[]): { status: number; stdout: string } {
  const stdout = execFileSync("npx", ["tsx", cli, ...args], { cwd: root, encoding: "utf8" });
  return { status: 0, stdout };
}
