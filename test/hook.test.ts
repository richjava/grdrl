import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateHook } from "../hooks/protect.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("protect hook", () => {
  it("blocks edits to eslint config and new suppressions", () => {
    const config = evaluateHook({
      tool_name: "Write",
      tool_input: { path: "eslint.config.mjs", contents: "export default [];\n" },
    });
    const suppression = evaluateHook({
      tool_name: "Edit",
      tool_input: { path: "src/Button.tsx", new_string: "// eslint-disable-next-line no-console\n" },
    });
    const source = evaluateHook({
      tool_name: "Edit",
      tool_input: { path: "src/Button.tsx", new_string: "export const Button = () => null;\n" },
    });
    assert.equal(config.permission, "deny");
    assert.equal(suppression.permission, "deny");
    assert.equal(source.permission, "allow");
  });

  it("blocks shell redirects onto protected files and allows reads", () => {
    const redirect = evaluateHook({ command: "echo export default [] > eslint.config.mjs" });
    const read = evaluateHook({ command: "cat eslint.config.mjs" });
    const workflow = evaluateHook({
      tool_name: "Write",
      tool_input: { path: ".github/workflows/ci.yml", contents: "name: ci\n" },
    });
    assert.equal(redirect.permission, "deny");
    assert.equal(read.permission, "allow");
    assert.equal(workflow.permission, "deny");
  });

  it("prints a deny decision as json", () => {
    const result = spawnSync(process.execPath, [path.join(root, "hooks", "protect.mjs")], {
      input: JSON.stringify({
        tool_name: "Write",
        tool_input: { path: "src/a.ts", contents: "// @ts-nocheck\n" },
      }),
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.permission, "deny");
    assert.equal(payload.hookSpecificOutput.permissionDecision, "deny");
  });
});
