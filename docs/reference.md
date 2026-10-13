# Reference

## Command

```text
grdrl init [--cwd dir]
grdrl check [--cwd dir] [--policy file] [--policy-ref git-ref] [--changed-since git-ref] [--format text|json]
```

`init` writes `grdrl.json` in `--cwd`. Each ESLint rule that is `warn` or `error` on at least one source file becomes an entry. `minSeverity` is the weakest of those current levels. The globs cover files that already meet that level, and leave out files where the rule is off. A lint script whose command contains `eslint` is included, preferring the script named `lint`. A CI config that runs `npm run <that script>` or `eslint` is included. An existing `grdrl.json` is left unchanged and init exits `2`.

| Flag | Meaning |
| --- | --- |
| `--cwd` | Project root. Defaults to the current directory. |
| `--policy` | Path to a policy file. Defaults to `grdrl.json` in `--cwd`. |
| `--policy-ref` | Git ref whose `grdrl.json` is the policy. This wins over `--policy`. |
| `--changed-since` | Git ref. Suppression findings are limited to files changed since that ref. |
| `--format` | `text` (default) or `json`. |

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | The tree meets the policy. |
| 1 | One or more violations. |
| 2 | The policy or arguments could not be read, or init refused to replace `grdrl.json`. |

## Policy file

`grdrl.json` version `1`.

```json
{
  "version": 1,
  "rules": [
    {
      "id": "no-restricted-imports",
      "minSeverity": "error",
      "globs": ["src/**/*.ts"],
      "options": [{ "paths": ["bad-package"] }]
    }
  ],
  "lint": {
    "script": "lint",
    "commandIncludes": "eslint"
  },
  "ci": {
    "commandIncludes": ["npm run lint"]
  }
}
```

`minSeverity` is `warn` or `error`. The effective ESLint severity must be at least that high for every source file matching the globs. `error` satisfies a minimum of `warn`.

`options`, when present, is the argument list after the severity. Those arguments must match for every source file the globs cover. Object key order does not matter. Array order does. A rule without `options` compares severity only. `grdrl init` does not copy options.

`lint.script` is a `package.json` script name. The script must run `commandIncludes` as a command, such as `eslint .` or `npx eslint`. A path whose filename is that command counts. Mentioning the command inside `echo` does not.

`ci.commandIncludes` is a list of strings. Some CI file must contain each string. The check looks for that text and does not prove the step runs. With no `ci.files` list, grdrl reads `.github/workflows/**/*.yml`, `.github/workflows/**/*.yaml`, `.gitlab-ci.yml`, and `bitbucket-pipelines.yml`. `ci.files` replaces that list with globs you name. Included files that those configs pull in are not followed unless a glob matches them.

`protectedPaths` is accepted and stored. `grdrl check` does not read it. The hook uses its own fixed list of filenames.

v1 resolves ESLint flat config only. When the config cannot be resolved, each required rule fails with kind `config-unresolved`.

## Exceptions

`grdrl.exceptions.json` is an array. A missing file means there are no exceptions.

```json
[
  {
    "ruleId": "no-console",
    "file": "src/legacy/widget.ts",
    "reason": "Vendored widget logs until the next release.",
    "expires": "2099-01-01"
  }
]
```

`reason` must be non-empty. `expires` is `YYYY-MM-DD` and is the last valid day, compared in UTC. A blanket `eslint-disable` is covered by `"ruleId": "*"`. An unreadable exceptions file is a violation of kind `exceptions-invalid`.

## Violation kinds

| Kind | Meaning |
| --- | --- |
| `rule-missing` | The rule is off for every matched file. |
| `rule-weakened` | The rule is present and below the minimum for every matched file. |
| `scope-narrowed` | Some matched files meet the minimum and some do not. |
| `options-changed` | A rule recorded `options`, and the effective ESLint options for a file differ. |
| `suppression` | `eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line`, `@ts-ignore`, or `@ts-nocheck` without an exception. |
| `lint-script` | The lint script is missing or does not run the required command. |
| `ci-workflow` | No CI config contains a required command string. Text inside the file is enough. |
| `config-unresolved` | Flat config could not be resolved, or no source file matched the globs. |
| `exceptions-invalid` | `grdrl.exceptions.json` could not be parsed. |

## JSON result

```json
{
  "status": "passed",
  "policyVersion": 1,
  "violations": []
}
```

`status` is `passed` or `failed`. Each violation has `ruleId`, `file`, `message`, `severity` (`error`), and `kind`. Suppressions include `line`.

## Hook

[hooks/protect.mjs](../hooks/protect.mjs) reads a JSON payload on stdin and writes a decision on stdout.

It denies a file tool when the path is an ESLint config, `grdrl.json`, `grdrl.exceptions.json`, a file under `.github/workflows/`, or the hook's own config. It denies content whose comment starts with `eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line`, `@ts-ignore`, or `@ts-nocheck`. Writes to `.gitlab-ci.yml` and `bitbucket-pipelines.yml` are not blocked. `grdrl check` still reads those files.

It denies a shell command that both writes (`>`, `>>`, `tee`, `sed -i`, `rm`, `mv`) and names one of those files.

A deny response sets `permission` to `deny` and includes the Claude Code `hookSpecificOutput` form. Invalid JSON on stdin is allowed through.
