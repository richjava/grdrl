import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { checkProject } from "../src/check.js";
import { matchesGlob } from "../src/files.js";
import { initProject } from "../src/init.js";
import { PolicyError } from "../src/policy.js";
import { materialize } from "../scripts/corpus.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "src", "cli.ts");

describe("init", () => {
  it("writes a policy from the enabled rules and the current tree passes", async () => {
    const cwd = materialize("01-rule-deleted");
    unlinkSync(path.join(cwd, "grdrl.json"));
    try {
      const report = await initProject(cwd);
      const policy = JSON.parse(readFileSync(report.policyPath, "utf8")) as {
        rules: { id: string; minSeverity: string; globs: string[] }[];
        lint: { script: string };
        ci: { commandIncludes: string[] };
      };
      const restricted = policy.rules.find((rule) => rule.id === "no-restricted-imports");
      const consoleRule = policy.rules.find((rule) => rule.id === "no-console");
      assert.equal(restricted, undefined);
      assert.equal(consoleRule?.minSeverity, "warn");
      assert.equal(policy.lint.script, "lint");
      assert.deepEqual(policy.ci.commandIncludes, ["npm run lint"]);
      const result = await checkProject({ cwd, policy: report.policy, today: "2026-10-10" });
      assert.equal(result.status, "passed");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("keeps a rule that is off in one directory out of that directory", async () => {
    const cwd = materialize("04-scope-override");
    unlinkSync(path.join(cwd, "grdrl.json"));
    try {
      const report = await initProject(cwd);
      const restricted = report.policy.rules.find((rule) => rule.id === "no-restricted-imports");
      assert.equal(restricted?.minSeverity, "error");
      assert.equal(restricted?.globs.some((pattern) => matchesGlob("src/app/page.ts", pattern)), false);
      assert.equal(restricted?.globs.some((pattern) => matchesGlob("src/index.ts", pattern)), true);
      const result = await checkProject({ cwd, policy: report.policy, today: "2026-10-10" });
      assert.equal(result.status, "passed");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("refuses to replace an existing policy", async () => {
    const cwd = materialize("13-severity-increased");
    const before = readFileSync(path.join(cwd, "grdrl.json"), "utf8");
    try {
      let caught: unknown;
      try {
        await initProject(cwd);
      } catch (error) {
        caught = error;
      }
      assert.ok(caught instanceof PolicyError);
      assert.match((caught as PolicyError).message, /will not replace it/);
      assert.equal(readFileSync(path.join(cwd, "grdrl.json"), "utf8"), before);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("init cli", () => {
  it("exits 2 when grdrl.json already exists", () => {
    const cwd = materialize("13-severity-increased");
    try {
      execFileSync("npx", ["tsx", cli, "init", "--cwd", cwd], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      assert.fail("expected init to refuse");
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      assert.equal(failure.status, 2);
      assert.match(failure.stderr ?? "", /will not replace it/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
