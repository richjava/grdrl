# How to use grdrl with a coding agent

Use this when an agent edits the repository and you want it to repair lint violations in the source, while leaving the policy files alone. This is also the setup for one person with no CI pipeline and no CODEOWNERS file. You run the check yourself before you commit, and you decide whether a change to `grdrl.json` stays.

## Add the hook

The hook runs before Cursor or Claude Code writes a file. It blocks edits to the ESLint config, `grdrl.json`, `grdrl.exceptions.json`, files under `.github/workflows/`, and the hook script. It also blocks new `eslint-disable`, `@ts-ignore`, and `@ts-nocheck` comments. Writes to `.gitlab-ci.yml` and `bitbucket-pipelines.yml` are not blocked. `grdrl check` still reads those files.

Copy [hooks/protect.mjs](../hooks/protect.mjs) into the project.

Cursor, `.cursor/hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "command": "node hooks/protect.mjs",
        "matcher": "Write|Edit|StrReplace|Delete"
      }
    ],
    "beforeShellExecution": [
      { "command": "node hooks/protect.mjs" }
    ]
  }
}
```

Claude Code, `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash",
        "hooks": [
          { "type": "command", "command": "node hooks/protect.mjs" }
        ]
      }
    ]
  }
}
```

Cloud agents that read `.cursor/hooks.json` from the repo run the same hook. The hook is best effort: a payload it cannot read is allowed through, and a shell command that writes the config without a redirect can slip past. The pull-request check is the backstop. See [How to fail a pull request](how-to-pull-request.md).

## Tell the agent how to repair a failure

Put this in `AGENTS.md` or the project's agent rules:

```markdown
After you change code, run `npx grdrl check --format json`.

When status is "failed", fix the files named in violations. Re-run the check after each fix.

A passing check is the end of the task. When the only remaining fix is a change to grdrl.json, grdrl.exceptions.json, the ESLint config, or a CI config, stop and ask a human to review that policy change.
```

JSON looks like this:

```json
{
  "status": "failed",
  "policyVersion": 1,
  "violations": [
    {
      "ruleId": "no-console",
      "file": "src/save.ts",
      "message": "eslint-disable-next-line for no-console in src/save.ts has no approved exception.",
      "severity": "error",
      "kind": "suppression",
      "line": 4
    }
  ]
}
```

The agent should change `src/save.ts`. It should leave the policy files for a person.

## The repair loop

The loop is inside one task:

1. The agent edits source.
2. It runs `npx grdrl check --format json`.
3. On failure, it edits the files in `violations` and runs the check again.
4. It stops on a passing check, or when the next edit would be a policy change.

`--changed-since <git-ref>` limits suppression findings to files changed since that ref. Rule, script, and CI findings still cover the whole tree. Use it when you want the agent to look at suppressions it just introduced:

```bash
npx grdrl check --format json --changed-since HEAD
```

## A timer loop

Cursor's `/loop` wakes an agent on a clock. Use it while a session is still editing the repo. The prompt on each tick is the repair instruction above. Example: `/loop 5m run npx grdrl check --format json and fix violations in source files`.

When the session is idle, ticks only repeat a check that already passed. Between sessions, [the pull-request check](how-to-pull-request.md) is the run that matters. The hook still applies on every tick that edits files.
