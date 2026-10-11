import { readFileSync } from "node:fs";
import path from "node:path";
import { lintScriptViolations, ciViolations, DEFAULT_CI_GLOBS, readCiFiles } from "./commands.js";
import { effectiveRuleSeverity } from "./eslintConfig.js";
import { exceptionCovers, todayUtc } from "./exceptions.js";
import { matchesAnyGlob, relativePosix, SOURCE_EXTENSIONS, walkFiles } from "./files.js";
import { minimumRank, severityName } from "./severity.js";
import { findSuppressions } from "./suppressions.js";
import type { CheckOptions, CheckResult, Violation } from "./types.js";

export async function checkProject(options: CheckOptions): Promise<CheckResult> {
  const today = options.today ?? todayUtc();
  const exceptions = options.exceptions ?? [];
  const violations: Violation[] = [];
  const cwd = path.resolve(options.cwd);
  const files = walkFiles(cwd).map((file) => relativePosix(cwd, file));

  for (const rule of options.policy.rules) {
    const matched = files.filter((file) => matchesAnyGlob(file, rule.globs) && SOURCE_EXTENSIONS.has(path.extname(file)));
    if (matched.length === 0) {
      violations.push({
        ruleId: rule.id,
        file: rule.globs[0] ?? "",
        message: `No source files matched ${rule.globs.join(", ")} for required rule ${rule.id}.`,
        severity: "error",
        kind: "config-unresolved",
      });
      continue;
    }

    const effective = await effectiveRuleSeverity(cwd, matched, rule.id);
    if (!effective.ok) {
      violations.push({
        ruleId: rule.id,
        file: "eslint.config.mjs",
        message: `Could not resolve effective config for ${rule.id}: ${effective.message}`,
        severity: "error",
        kind: "config-unresolved",
      });
      continue;
    }

    const required = minimumRank(rule.minSeverity);
    const weak = matched.filter((file) => (effective.byFile.get(file) ?? 0) < required);
    const strong = matched.length - weak.length;
    for (const file of weak) {
      const actual = severityName(effective.byFile.get(file) ?? 0);
      const kind = strong > 0 ? "scope-narrowed" : actual === "off" ? "rule-missing" : "rule-weakened";
      violations.push({
        ruleId: rule.id,
        file,
        message: `${rule.id} is ${actual} for ${file}. Approved minimum is ${rule.minSeverity}.`,
        severity: "error",
        kind,
      });
    }
  }

  const suppressionGlobs = [...new Set(options.policy.rules.flatMap((rule) => rule.globs))];
  if (suppressionGlobs.length > 0) {
    const suppressionFiles = files.filter(
      (file) => matchesAnyGlob(file, suppressionGlobs) && SOURCE_EXTENSIONS.has(path.extname(file)),
    );
    for (const file of suppressionFiles) {
      if (options.changedFiles && !options.changedFiles.has(file)) {
        continue;
      }
      const source = readFileSync(path.join(cwd, file), "utf8");
      for (const suppression of findSuppressions(source)) {
        if (exceptionCovers(exceptions, file, suppression.ruleId, today)) {
          continue;
        }
        violations.push({
          ruleId: suppression.ruleId,
          file,
          message: `${suppression.directive} for ${suppression.ruleId} in ${file} has no approved exception.`,
          severity: "error",
          kind: "suppression",
          line: suppression.line,
        });
      }
    }
  }

  if (options.policy.lint) {
    violations.push(...lintScriptViolations(cwd, options.policy.lint));
  }
  if (options.policy.ci) {
    const globs = options.policy.ci.files ?? DEFAULT_CI_GLOBS;
    violations.push(...ciViolations(options.policy.ci.commandIncludes, readCiFiles(cwd, files, globs)));
  }

  violations.sort((left, right) => {
    const kind = left.kind.localeCompare(right.kind);
    if (kind !== 0) {
      return kind;
    }
    const file = left.file.localeCompare(right.file);
    if (file !== 0) {
      return file;
    }
    return (left.line ?? 0) - (right.line ?? 0);
  });

  return {
    status: violations.length === 0 ? "passed" : "failed",
    policyVersion: options.policy.version,
    violations,
  };
}
