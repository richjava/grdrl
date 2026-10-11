# Why the base branch holds the policy

A lint rule only constrains an agent when something the agent does not control still runs that rule. grdrl is that detector. It separates three layers.

**Policy.** `grdrl.json` lists the rule ids, the minimum severity, and the globs that must stay covered. You write this file for the rules you want kept. Installing the tool does not copy the current ESLint config into the policy. A weak config would otherwise become the approved one.

**Enforcement.** ESLint, the `lint` script, and the CI config are what make the policy true in the tree. grdrl asks ESLint for the effective config of the files that match each glob. A rule that is `error` at the top of the config and `off` for `src/app/**` fails for the files under `src/app`.

**Assurance.** `grdrl check` reports what is true now. `grdrl check --policy-ref <base>` reads the policy from a git ref, usually the pull request base, and evaluates the working tree against it. A branch that deletes a requirement from its own `grdrl.json` can pass a check that reads that file. The same tree fails when the policy comes from the base ref.

A checksum of `eslint.config.mjs` sees that the file changed. It also flags a comment-only edit and a change that raises a rule from `warn` to `error`. It misses an `eslint-disable` comment, a lint script replaced with `echo ok`, and a CI config that no longer runs lint. [Bypass coverage](bypass-coverage.md) is the record of those cases.

The hook blocks the obvious edit during an agent turn. A required pipeline blocks a merge when the job never reports. Review on the policy files is what makes an exception, or a rewritten CI config, a human decision. Each of those covers a different change.
