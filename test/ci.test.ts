import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { checkProject } from "../src/check.js";
import { initProject } from "../src/init.js";
import { parsePolicy, PolicyError } from "../src/policy.js";
import { materialize } from "../scripts/corpus.js";
import type { Policy } from "../src/types.js";

const command = "npm run lint";

function emptyProject(): string {
  return mkdtempSync(path.join(tmpdir(), "grdrl-ci-"));
}

function policy(files?: string[]): Policy {
  return {
    version: 1,
    rules: [],
    ci: files ? { commandIncludes: [command], files } : { commandIncludes: [command] },
  };
}

describe("ci config", () => {
  it("accepts the command in a GitHub, GitLab, or Bitbucket file", async () => {
    const cwd = emptyProject();
    try {
      mkdirSync(path.join(cwd, ".github", "workflows"), { recursive: true });
      writeFileSync(path.join(cwd, ".github", "workflows", "ci.yaml"), `run: ${command}\n`);
      assert.equal((await checkProject({ cwd, policy: policy() })).status, "passed");

      rmSync(path.join(cwd, ".github"), { recursive: true, force: true });
      writeFileSync(path.join(cwd, ".gitlab-ci.yml"), `script:\n  - ${command}\n`);
      assert.equal((await checkProject({ cwd, policy: policy() })).status, "passed");

      rmSync(path.join(cwd, ".gitlab-ci.yml"));
      writeFileSync(path.join(cwd, "bitbucket-pipelines.yml"), `script:\n  - ${command}\n`);
      assert.equal((await checkProject({ cwd, policy: policy() })).status, "passed");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("fails when a known CI file omits the command", async () => {
    const cwd = emptyProject();
    try {
      writeFileSync(path.join(cwd, ".gitlab-ci.yml"), "script:\n  - echo ok\n");
      const result = await checkProject({ cwd, policy: policy() });
      assert.equal(result.status, "failed");
      assert.equal(result.violations[0]?.kind, "ci-workflow");
      assert.equal(result.violations[0]?.file, ".gitlab-ci.yml");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("uses ci.files and ignores the default names", async () => {
    const cwd = emptyProject();
    try {
      mkdirSync(path.join(cwd, "pipelines"));
      writeFileSync(path.join(cwd, "pipelines", "lint.yml"), `script: ${command}\n`);
      writeFileSync(path.join(cwd, ".gitlab-ci.yml"), "script:\n  - echo ok\n");
      const defaults = await checkProject({ cwd, policy: policy() });
      assert.equal(defaults.status, "failed");
      const custom = await checkProject({ cwd, policy: policy(["pipelines/**/*.yml"]) });
      assert.equal(custom.status, "passed");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("rejects an empty ci.files list", () => {
    assert.throws(
      () => parsePolicy({ version: 1, rules: [], ci: { commandIncludes: [command], files: [] } }),
      PolicyError,
    );
  });

  it("records a CI command from .gitlab-ci.yml during init", async () => {
    const cwd = materialize("11-workflow-removed");
    writeFileSync(path.join(cwd, ".gitlab-ci.yml"), `script:\n  - ${command}\n`);
    unlinkSync(path.join(cwd, "grdrl.json"));
    try {
      const report = await initProject(cwd);
      assert.deepEqual(report.policy.ci?.commandIncludes, [command]);
      const result = await checkProject({ cwd, policy: report.policy, today: "2026-10-10" });
      assert.equal(result.status, "passed");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
