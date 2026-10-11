import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readCiFiles } from "./commands.js";
import { checkProject } from "./check.js";
import { readProjectRules, type ProjectFile } from "./eslintConfig.js";
import { relativePosix, walkFiles } from "./files.js";
import { globsCovering } from "./globs.js";
import { loadExceptionsFile, parsePolicy, PolicyError, policyPath } from "./policy.js";
import { severityName } from "./severity.js";
import type { Policy, RequiredRule } from "./types.js";

export type InitReport = {
  policyPath: string;
  policy: Policy;
  notes: string[];
};

export async function initProject(cwd: string): Promise<InitReport> {
  const root = path.resolve(cwd);
  const destination = policyPath(root);
  if (existsSync(destination)) {
    throw new PolicyError(`${destination} already exists. Init will not replace it.`);
  }

  const discovered = await readProjectRules(root);
  if (!discovered.ok) {
    throw new PolicyError(discovered.message);
  }
  if (discovered.files.every((file) => file.ignored)) {
    throw new PolicyError("No source files found. grdrl.json was not written.");
  }

  const rules = rulesFromProject(discovered.files);
  if (rules.length === 0) {
    throw new PolicyError("ESLint has no rules set to warn or error. grdrl.json was not written.");
  }

  const policy: Policy = { version: 1, rules };
  const notes: string[] = [`${rules.length} rules copied from the ESLint config at their current level.`];
  const lint = discoverLint(root);
  if (lint) {
    policy.lint = lint;
    notes.push(`Lint script "${lint.script}" is included.`);
  } else {
    notes.push("No ESLint script was found in package.json, so the lint section was left out.");
  }

  const ciScan = readCiFiles(root, walkFiles(root).map((file) => relativePosix(root, file)));
  const ciCommand = discoverCi(ciScan.text, lint?.script ?? null);
  if (ciCommand) {
    policy.ci = { commandIncludes: [ciCommand] };
    notes.push(`CI command "${ciCommand}" is included.`);
  } else {
    notes.push("No CI config running ESLint was found, so the ci section was left out.");
  }

  const validated = parsePolicy(policy);
  writeFileSync(destination, `${JSON.stringify(validated, null, 2)}\n`, { flag: "wx" });

  const exceptions = existsSync(path.join(root, "grdrl.exceptions.json"))
    ? loadExceptionsFile(path.join(root, "grdrl.exceptions.json"))
    : [];
  const result = await checkProject({ cwd: root, policy: validated, exceptions });
  const blocking = result.violations.filter((violation) => violation.kind !== "suppression");
  if (blocking.length > 0) {
    unlinkSync(destination);
    throw new PolicyError(
      `Init removed grdrl.json because the current tree does not meet it. ${blocking.map((violation) => violation.message).join(" ")}`,
    );
  }
  if (result.violations.length > 0) {
    notes.push("Existing suppressions are still reported by grdrl check.");
  }
  notes.push("Rule options were not copied. Review grdrl.json before committing it.");
  return { policyPath: destination, policy: validated, notes };
}

export function rulesFromProject(files: readonly ProjectFile[]): RequiredRule[] {
  const ids = new Set<string>();
  for (const file of files) {
    if (file.ignored) {
      continue;
    }
    for (const [ruleId, rank] of file.rules) {
      if (rank > 0) {
        ids.add(ruleId);
      }
    }
  }

  return [...ids].sort().map((ruleId) => {
    const enabled = files.filter((file) => !file.ignored && (file.rules.get(ruleId) ?? 0) > 0);
    const floor = Math.min(...enabled.map((file) => file.rules.get(ruleId) ?? 0));
    const minSeverity = severityName(floor);
    if (minSeverity === "off") {
      throw new PolicyError(`Rule ${ruleId} has no enabled severity.`);
    }
    const included = enabled.map((file) => file.relativePath);
    const excluded = files
      .filter((file) => file.ignored || (file.rules.get(ruleId) ?? 0) < floor)
      .map((file) => file.relativePath);
    return { id: ruleId, minSeverity, globs: globsCovering(included, excluded) };
  });
}

export function discoverLint(cwd: string): Policy["lint"] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }
  const scripts = (parsed as { scripts?: unknown }).scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
    return undefined;
  }
  const matches = Object.entries(scripts).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].includes("eslint"),
  );
  const chosen = matches.find(([name]) => name === "lint") ?? matches[0];
  if (!chosen) {
    return undefined;
  }
  return { script: chosen[0], commandIncludes: "eslint" };
}

export function discoverCi(workflowText: string | null, lintScript: string | null): string | null {
  if (!workflowText) {
    return null;
  }
  if (lintScript && workflowText.includes(`npm run ${lintScript}`)) {
    return `npm run ${lintScript}`;
  }
  if (workflowText.includes("eslint")) {
    return "eslint";
  }
  return null;
}
