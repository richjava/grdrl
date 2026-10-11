# Get a check running

This tutorial installs grdrl on a project that already has an ESLint flat config, writes one required rule, and shows a passing check become a failing one.

You need Node.js 20 or newer, and a `package.json` whose `lint` script runs ESLint. The examples use `no-console`.

## Install

From the project root:

```bash
npm install --save-dev grdrl
```

## Name one rule you want kept

Create `grdrl.json`. You can draft it from every rule the config already has turned on:

```bash
npx grdrl init
```

Init will not replace an existing `grdrl.json`. This tutorial writes one rule by hand so you can see the shape. It uses `no-console` at `error` for TypeScript under `src/`.

```json
{
  "version": 1,
  "rules": [
    {
      "id": "no-console",
      "minSeverity": "error",
      "globs": ["src/**/*.ts"]
    }
  ],
  "lint": {
    "script": "lint",
    "commandIncludes": "eslint"
  }
}
```

In `eslint.config.js` or `eslint.config.mjs`, that rule needs to be `error` for the same files. A stricter setting is fine. `warn` is below this minimum and the check will fail.

## Run it

```bash
npx grdrl check
```

A project that still enforces the rule prints:

```text
Policy integrity report
Passed

Required enforcement still matches the approved policy.
```

## See it fail

In a file under `src/`, add a line comment that disables `no-console` for the next line. The comment text is `eslint-disable-next-line no-console`.

Run `npx grdrl check` again. The report names that file and exits `1`.

Delete the line and run the check once more. It passes.

You now have a check you can run locally. Next, wire it into an agent: [How to use it with an agent](how-to-agent.md).
