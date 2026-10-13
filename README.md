<img src="docs/grdrl-logo.jpg" alt="grdrl" width="100%">

# grdrl

grdrl, short for "Guardrail", keeps required lint rules in force when a coding agent would rather silence or weaken them. 

**The problem:** Faced with a lint error, an agent will often silence or weaken the check instead of fixing the code. The same agent can edit `eslint.config.mjs`, so the check that should have caught that change is gone too.

- An `eslint-disable` comment with no exception
- An `@ts-ignore` comment with no exception
- A rule lowered from `error` to `warn`
- A rule turned off for one file
- A lint script that no longer runs ESLint

**What grdrl does:** You list the rules that must stay in force in `grdrl.json`. With the hook installed, it blocks a disable comment or an edit to the ESLint config during the task, and tells the agent to fix the source. In CI, `grdrl check --policy-ref` loads that list from the pull request's base commit and fails if the branch weakened those rules, added a suppression, or removed the lint or CI command. Editing `grdrl.json` on the same branch leaves that check failed. The agent can still change the code, and a person reviews any change to the policy.

For a rule the agent must not soften, set `"minSeverity": "error"`. That is the strictest floor grdrl can require. `warn` in ESLint then fails the check.

```json
{
  "version": 1,
  "rules": [
    {
      "id": "no-restricted-imports",
      "minSeverity": "error",
      "globs": ["src/**/*.ts"]
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

`minSeverity` is the weakest level you will accept. `"warn"` still passes when the rule is `error`. `"error"` fails when the rule has been lowered to `warn` or turned off. The project needs an ESLint flat config, `eslint.config.js` or `eslint.config.mjs`. If grdrl cannot read that file, the check fails.

`grdrl.exceptions.json` is the allow-list for a suppression you intend to keep. Each entry names one rule, one file, a reason, and a date it expires. Until that date, a disable comment in that file for that rule passes the check. A comment that disables every rule needs `"ruleId": "*"`. grdrl trusts this file, so on a shared repository a person has to approve edits to it, and to `grdrl.json`, the ESLint config, and the CI config, before those edits can merge. GitHub and GitLab name those people in a CODEOWNERS file. Bitbucket uses default reviewers. Working alone, you review those files yourself. The shape of an entry is in the [reference](docs/reference.md).

## What it flags

- A required rule missing, lowered below its minimum severity, or turned off for a file inside its globs.
- Recorded rule options that differ from the options ESLint applies.
- `eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line`, `@ts-ignore`, and `@ts-nocheck` without an exception.
- A lint script that does not run the configured command.
- A CI file that no longer contains each configured command.

Strengthening a rule is allowed. Options are compared only when a rule records an `options` array. The [explanation](docs/explanation.md) covers why that array is optional, and what the lint and CI checks do not prove.

Text and JSON both list the rule, file, and what changed. They do not guess intent.

## Run it

```bash
npm install --save-dev @richjava/grdrl
npx grdrl init
npx grdrl check
npx grdrl check --format json
npx grdrl check --policy-ref origin/main
npx grdrl check --changed-since HEAD
```

`npx grdrl init` creates `grdrl.json` from the rules ESLint already has set to `warn` or `error`, each at that current level. It also records a lint script and a CI command when it finds them running ESLint. If `grdrl.json` already exists, init leaves it alone and exits `2`. Read the file before committing it. Rule options are not copied.

`npx grdrl check` compares the working tree with `grdrl.json`. Exit `0` when the tree still meets the policy, `1` when enforcement was weakened, `2` when the policy could not be read.

`npx grdrl check --format json` prints that same result as JSON. Each violation names the rule, the file, and what changed.

`npx grdrl check --policy-ref origin/main` reads `grdrl.json` from that git ref and evaluates the working tree against it. Use the pull request base SHA in CI.

`npx grdrl check --changed-since HEAD` limits suppression findings to files changed since that ref. Rule, script, and CI findings still use the whole tree.

## Working alone

You do not need a CI pipeline or a CODEOWNERS file. Those matter when someone else can merge. On your own machine:

1. Run `npx grdrl init` and read `grdrl.json`. If you have no CI config, delete the `ci` section. A `ci` entry makes the check look for that command in `.github/workflows`, `.gitlab-ci.yml`, or `bitbucket-pipelines.yml`, and it fails when none of those files exist.
2. Copy [hooks/protect.mjs](hooks/protect.mjs) into the project and point Cursor or Claude Code at it, as in [How to use it with an agent](docs/how-to-agent.md). The hook blocks a disable comment and edits to the ESLint config, `grdrl.json`, and `grdrl.exceptions.json` while the agent is writing.
3. Tell the agent to run `npx grdrl check --format json` and fix the files it names. Run `npx grdrl check` yourself before you commit. If `grdrl.json` or `grdrl.exceptions.json` changed, that change is yours to keep or discard. You are the reviewer.

## Working in a team

Do those three steps first: create `grdrl.json` (`npx grdrl init`), [install the hook](docs/how-to-agent.md), and run the check (`npx grdrl check`) before you commit. Then add two controls, because someone other than the author can merge.

1. Run the check in CI with `--policy-ref` set to the pull request's base commit, so a branch that deletes a rule from its own `grdrl.json` is still judged against the list on the base branch. Mark that job as required. If a pull request removes the job, the host holds the merge because the check never reports a result. [How to fail a pull request](docs/how-to-pull-request.md) has the command for GitHub Actions, GitLab CI, and Bitbucket Pipelines.
2. Require a person to approve changes to `grdrl.json`, `grdrl.exceptions.json`, the ESLint config, and the CI config. GitHub and GitLab use a CODEOWNERS file. Bitbucket uses default reviewers. grdrl treats an exception in the pull request as allowed, so that approval is the gate. The file lists are in [How to fail a pull request](docs/how-to-pull-request.md).

## What holds the line

| Control | What it stops |
| --- | --- |
| `grdrl check` in the working tree | Accidental weakening, and an agent that does not also edit the manifest |
| `grdrl check --policy-ref <base>` | A manifest edited in the same change to hide a deleted rule or a removed CI command |
| The grdrl CI job, required by the host | Merging a pull request that removed that job. On GitHub the job runs in GitHub Actions, and a required status check holds the merge when it never reports. GitLab and Bitbucket run the same command and hold the merge with their own required pipeline. |
| A Cursor or Claude Code hook | The agent inserting a disable comment, or editing the ESLint config, before that write happens. |
| Review of the policy files | Merging a change to `grdrl.exceptions.json` or the pipeline until a person approves it. GitHub and GitLab name those people in a CODEOWNERS file. Bitbucket uses default reviewers. grdrl treats the exception file in the pull request as allowed, so this review is the gate. |

The hook can be skipped, and a pull request can replace the pipeline with a no-op that still reports success. A required check plus review of the pipeline file are the merge control. Review `.github/workflows` on GitHub, `.gitlab-ci.yml` on GitLab, or `bitbucket-pipelines.yml` on Bitbucket. This package does not claim a local checksum makes the repo tamper-proof.

The hook files and the CI setup for GitHub, GitLab, and Bitbucket are written out in the how-to guides below.

[docs/bypass-coverage.md](docs/bypass-coverage.md) records 27 cases: what a config hash catches, what an in-repo checksum misses once it is rewritten, what the semantic check catches, and what only the base-branch policy catches. `npm test` runs that corpus.

## Go further

| You want to | Read |
| --- | --- |
| Learn the tool by running it once | [Tutorial](docs/tutorial.md) |
| Keep a coding agent inside the policy, including the repair loop | [How to use it with an agent](docs/how-to-agent.md) |
| Fail a pull request when enforcement was weakened | [How to fail a pull request](docs/how-to-pull-request.md) |
| Look up flags, exceptions, or exit codes | [Reference](docs/reference.md) |
| Understand why the check is shaped this way | [Explanation](docs/explanation.md) |
