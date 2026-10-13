# How to fail a pull request when enforcement was weakened

Use this when a branch should be blocked from merging after someone, or an agent, weakens a required rule, adds a suppression, or removes the lint command.

The working tree's `grdrl.json` is the policy a local check believes. In CI, load `grdrl.json` from the pull request's base commit so a branch cannot delete a requirement and then pass the check that reads the edited file.

## GitHub Actions

The package has to be installed before the action runs. `fetch-depth: 0` makes the base commit available for `--policy-ref`.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npm ci
- uses: ./
  with:
    policy-ref: ${{ github.event.pull_request.base.sha }}
```

`action.yml` runs `npx --no-install grdrl check`. On a push to the default branch there is no base SHA. Run `npx grdrl check` against the working tree for that event.

The SHA comes from the host event. A pull request must not choose it. Do not pass the head ref, and do not read the ref from a file on the branch. A person running the check on their own machine can still pass `origin/main`.

This repository's own workflow builds the CLI and calls `node dist/cli.js check`, because the package being tested is the repository itself. A project that depends on grdrl uses the action above.

### Require the GitHub check

In the repository ruleset, require the status check this workflow reports. A pull request that deletes the job then never reports the check, and the ruleset holds the merge.

Also require review on the policy files. The checker trusts `grdrl.exceptions.json` from the working tree, so an exception added in the same pull request counts. CODEOWNERS is the review gate:

```text
grdrl.json @your-org/maintainers
grdrl.exceptions.json @your-org/maintainers
eslint.config.mjs @your-org/maintainers
.github/workflows/ci.yml @your-org/maintainers
```

Replace `@your-org/maintainers` with a GitHub user or team.

A workflow edit that still reports success under the same check name can pass the status check. Review on `.github/workflows` is what makes that edit visible.

## GitLab CI

Use the same command. On a merge request, `--policy-ref` is `CI_MERGE_REQUEST_DIFF_BASE_SHA`. That variable is empty on a branch pipeline, so the job then checks the working tree. `GIT_DEPTH: 0` makes the base commit available to git.

```yaml
grdrl:
  variables:
    GIT_DEPTH: "0"
  script:
    - npm ci
    - |
      if [ -n "$CI_MERGE_REQUEST_DIFF_BASE_SHA" ]; then
        npx --no-install grdrl check --policy-ref "$CI_MERGE_REQUEST_DIFF_BASE_SHA"
      else
        npx --no-install grdrl check
      fi
```

In the project settings, require a successful pipeline before merge. Name the reviewers for `grdrl.json`, `grdrl.exceptions.json`, the ESLint config, and `.gitlab-ci.yml` in a CODEOWNERS file.

## Bitbucket Pipelines

On a pull request pipeline, `--policy-ref` is `BITBUCKET_PR_DESTINATION_COMMIT`. That variable is set only for pull request builds. A branch pipeline checks the working tree.

```yaml
pipelines:
  pull-requests:
    "**":
      - step:
          script:
            - npm ci
            - npx --no-install grdrl check --policy-ref "$BITBUCKET_PR_DESTINATION_COMMIT"
  branches:
    main:
      - step:
          script:
            - npm ci
            - npx --no-install grdrl check
```

Require the pipeline to pass before merge, and require a reviewer for `bitbucket-pipelines.yml` and the policy files. Bitbucket uses default reviewers and branch restrictions for that review.

## Which files count

grdrl reads `.github/workflows`, `.gitlab-ci.yml`, and `bitbucket-pipelines.yml` for the strings in `ci.commandIncludes`. A pipeline file in another path belongs in `ci.files`. The [reference](reference.md) lists the default names. The hook blocks writes under `.github/workflows`. It does not block writes to `.gitlab-ci.yml` or `bitbucket-pipelines.yml`. `grdrl check` still reads those two files.
