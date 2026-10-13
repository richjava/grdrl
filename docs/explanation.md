# Why the check is shaped this way

A lint rule only constrains an agent when something the agent does not control still runs that rule. grdrl is that detector. It separates three layers.

**Policy.** `grdrl.json` lists the rule ids, the minimum severity, and the globs that must stay covered. You write this file for the rules you want kept. Installing the tool does not copy the current ESLint config into the policy. A weak config would otherwise become the approved one.

**Enforcement.** ESLint, the `lint` script, and the CI config are what make the policy true in the tree.

**Assurance.** `grdrl check` reports what is true now. `grdrl check --policy-ref <base>` reads the policy from a git ref, usually the pull request base, and evaluates the working tree against it. A branch that deletes a requirement from its own `grdrl.json` can pass a check that reads that file. The same tree fails when the policy comes from the base ref.

## Effective severity

grdrl asks ESLint for the effective config of each file that matches a rule's globs. Flat config can turn a rule off for one directory while the top of the file still shows `error`. The check fails for the files under that directory. A name-only reading of `eslint.config.mjs` can miss that.

If grdrl cannot resolve the flat config, the check fails. A missing config is a failure.

## Options are exact when you record them

The default check compares severity. A rule can stay at `error` while its options are emptied, and that passes. Emptying the `paths` list of `no-restricted-imports` is the case this leaves open.

Record an `options` array on the rule when those arguments must stay:

```json
{
  "id": "no-restricted-imports",
  "minSeverity": "error",
  "globs": ["src/**/*.ts"],
  "options": [{ "paths": ["bad-package"] }]
}
```

The array is the arguments after the severity. The check compares them with the arguments ESLint applies to each matched file. Object key order does not matter. Array order does. A difference in either direction fails, including a change that adds a restriction. Whether an options change is stricter depends on the rule, so the approved array is exact. Changing it is a change to `grdrl.json`. The base-branch check and a person review that change.

`grdrl init` does not copy options. A weak options list would otherwise become the approved one. The shape is in the [reference](reference.md).

## The lint script and the CI file

The lint check requires the script to run the configured command. `eslint .`, `npx eslint`, and a path whose filename is `eslint` pass. `echo eslint` fails, because `eslint` is an argument of `echo`.

The CI check looks for each configured string in the workflow file. A workflow whose only copy of that string is inside `echo` still passes. The check notices when the text disappears. It does not prove the step runs. A required status check holds the merge when the job never reports, and a person reviews the workflow file. [Bypass coverage](bypass-coverage.md) records both cases.

## The hook steers the agent

With the hook installed, it blocks a disable comment and edits to the ESLint config, `grdrl.json`, `grdrl.exceptions.json`, and the hook script while the agent is writing. It also watches for a few common shell writes. A payload it cannot read is allowed through. An agent can skip the hook, edit the installed package, or delete the CI job.

The check that loads `grdrl.json` from the base commit is the assurance for a policy edited on the branch. When the job is deleted, the host's required check is what holds the merge, because the job never reports. The hook setup is in [How to use it with an agent](how-to-agent.md).

## The project's own ESLint

grdrl uses the ESLint package the project has installed, version 9 or newer. The effective config is the one that project already runs. A plugin or ESLint upgrade can change what a rule means while the severity stays `error`. grdrl reads the severity and options that package reports. It does not attest the plugin's implementation.

## What the checker leaves to people and the host

`grdrl.exceptions.json` is privileged policy. A wildcard entry covers a suppression, and the check passes. Review of that file is the control.

Globs are the file boundary. Code under a root the policy does not name is not checked. `.mts` and `.cts` are checked when a glob matches them. A glob of `src/**/*.ts` does not cover `src/file.mts`.

CI text, including a comment, an `if:`, or `continue-on-error`, is not proof the job runs on the pull request. The host's required check is that proof.

`--policy-ref` is only as trusted as the SHA the job is given. That SHA comes from the host event. [How to fail a pull request](how-to-pull-request.md) shows the value each host provides.

## A checksum answers a different question

A checksum of `eslint.config.mjs` sees that the file changed. It also flags a comment-only edit and a change that raises a rule from `warn` to `error`. It misses an `eslint-disable` comment, a lint script replaced with `echo ok`, and a CI config that no longer runs lint. [Bypass coverage](bypass-coverage.md) is the record of those cases.

The hook blocks the obvious edit during an agent turn. A required pipeline blocks a merge when the job never reports. Review on the policy files is what makes an exception, or a rewritten CI config, a human decision. Each of those covers a different change.
