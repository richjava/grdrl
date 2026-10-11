# Bypass coverage

Spec for the first checker. Each case overlays [fixtures/baseline](../fixtures/baseline). `npm test` fails when a result drifts from `expected.json`.

Config hash is the SHA-256 of `eslint.config.mjs` compared with the baseline file. Stored hash is that same comparison, except `20-rewritten-checksum`, which rewrites the in-repo checksum to the new bytes before comparing. Semantic uses the case's own `grdrl.json`. Trusted policy uses the baseline `grdrl.json`, which is what `grdrl check --policy-ref <base>` loads.

| Case | Intent | Config hash | Stored hash | Semantic | Trusted policy |
| --- | --- | --- | --- | --- | --- |
| 01-rule-deleted | bypass | flag | flag | fail | fail |
| 02-severity-to-warn | bypass | flag | flag | fail | fail |
| 03-severity-to-off | bypass | flag | flag | fail | fail |
| 04-scope-override | bypass | flag | flag | fail | fail |
| 05-blanket-eslint-disable | bypass | pass | pass | fail | fail |
| 06-disable-next-line | bypass | pass | pass | fail | fail |
| 07-ts-nocheck | bypass | pass | pass | fail | fail |
| 08-ts-ignore | bypass | pass | pass | fail | fail |
| 09-lint-script-removed | bypass | pass | pass | fail | fail |
| 10-lint-script-noop | bypass | pass | pass | fail | fail |
| 11-workflow-removed | bypass | pass | pass | fail | fail |
| 12-manifest-and-rule-removed | bypass | flag | flag | pass | fail |
| 13-severity-increased | legitimate | flag | flag | pass | pass |
| 14-config-comment | legitimate | flag | flag | pass | pass |
| 15-approved-exception | legitimate | pass | pass | pass | pass |
| 16-expired-exception | bypass | pass | pass | fail | fail |
| 17-ci-command-noop | bypass | pass | pass | fail | fail |
| 18-local-policy-gutted | bypass | pass | pass | pass | fail |
| 19-options-emptied | bypass | flag | flag | pass | pass |
| 20-rewritten-checksum | bypass | flag | pass | pass | fail |

## Notes

- **01-rule-deleted** (bypass): Required rule removed from the flat config. External hash and semantic check both see the deleted rule.
- **02-severity-to-warn** (bypass): Required rule lowered from error to warn. A checksum sees a change. Semantic check explains the severity drop.
- **03-severity-to-off** (bypass): Required rule switched off. Severity off fails the approved minimum of error.
- **04-scope-override** (bypass): Rule remains error globally and is turned off for src/app/**. Effective config for src/app/page.ts is off. A name-only scan of the config can miss this.
- **05-blanket-eslint-disable** (bypass): Blanket eslint-disable added in a source file. eslint.config.mjs is unchanged, so a config checksum misses it.
- **06-disable-next-line** (bypass): eslint-disable-next-line for a named rule, with no exception. Config checksum misses an inline suppression.
- **07-ts-nocheck** (bypass): @ts-nocheck added at the top of a source file. TypeScript suppression does not touch the ESLint config.
- **08-ts-ignore** (bypass): @ts-ignore added in a nested source file. Config checksum misses the suppression.
- **09-lint-script-removed** (bypass): package.json lint script removed. The flat config is intact. The lint command is gone.
- **10-lint-script-noop** (bypass): Lint script replaced with a command that does not run ESLint. The script name remains. It no longer invokes eslint.
- **11-workflow-removed** (bypass): CI workflow file removed. Semantic check fails only if it still runs. A required status check is what blocks the merge when this job no longer reports.
- **12-manifest-and-rule-removed** (bypass): Required rule deleted from the config and from the local manifest. A check that trusts the working tree manifest passes. A check against the base-branch policy fails.
- **13-severity-increased** (legitimate): no-console raised from warn to error. The policy minimum is warn. Checksum flags a strengthening change. Semantic check allows it.
- **14-config-comment** (legitimate): Comment-only edit to eslint.config.mjs. Checksum false positive. Effective rules are unchanged.
- **15-approved-exception** (legitimate): Named suppression covered by an unexpired exception. The exception file is the allowlist. It is meant to be CODEOWNERS-protected.
- **16-expired-exception** (bypass): Suppression whose exception expiry is in the past. An expired exception does not cover the suppression.
- **17-ci-command-noop** (bypass): Workflow still exists and no longer runs npm run lint. Config checksum misses a workflow edit.
- **18-local-policy-gutted** (bypass): Local manifest drops every requirement and the workflow is deleted. ESLint config is unchanged. Only a check that loads grdrl.json from the base ref catches this. The config checksum stays quiet.
- **19-options-emptied** (bypass): no-restricted-imports stays error while its restricted path list is emptied. Known gap. v1 compares severity and file scope, not rule options.
- **20-rewritten-checksum** (bypass): Rule removed, local manifest updated, and the in-repo checksum rewritten to match. An in-repo checksum is updated by the same change, so it passes. External hash still flags. Local semantic check passes. Trusted policy fails.

A removed workflow is a semantic failure when this checker still runs. If the pull request deletes the job and nothing reports the required status check, merge protection is the control that blocks it.
