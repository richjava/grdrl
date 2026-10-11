import { readFileSync } from "node:fs";
import path from "node:path";
import type { Exception, Policy, RequiredRule } from "./types.js";

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}

export function parsePolicy(value: unknown): Policy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PolicyError("Policy must be a JSON object.");
  }
  const record = value as Record<string, unknown>;
  if (record.version !== 1) {
    throw new PolicyError("Policy version must be 1.");
  }
  if (!Array.isArray(record.rules)) {
    throw new PolicyError("Policy rules must be an array.");
  }

  const rules = record.rules.map((rule, index) => parseRule(rule, index));
  const policy: Policy = { version: 1, rules };

  if (record.lint !== undefined) {
    policy.lint = parseLint(record.lint);
  }
  if (record.ci !== undefined) {
    policy.ci = parseCi(record.ci);
  }
  if (record.protectedPaths !== undefined) {
    if (!Array.isArray(record.protectedPaths) || record.protectedPaths.some((item) => typeof item !== "string")) {
      throw new PolicyError("protectedPaths must be an array of strings.");
    }
    policy.protectedPaths = record.protectedPaths;
  }

  return policy;
}

export function loadPolicyFile(filePath: string): Policy {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PolicyError(`Could not read policy ${filePath}: ${message}`);
  }
  return parsePolicy(parsed);
}

export function parseExceptions(value: unknown): Exception[] {
  if (!Array.isArray(value)) {
    throw new PolicyError("Exceptions must be a JSON array.");
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new PolicyError(`Exception at index ${index} must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.ruleId !== "string" || record.ruleId.trim() === "") {
      throw new PolicyError(`Exception at index ${index} needs a ruleId.`);
    }
    if (typeof record.file !== "string" || record.file.trim() === "") {
      throw new PolicyError(`Exception at index ${index} needs a file.`);
    }
    if (typeof record.reason !== "string") {
      throw new PolicyError(`Exception at index ${index} needs a reason.`);
    }
    const exception: Exception = {
      ruleId: record.ruleId,
      file: record.file,
      reason: record.reason,
    };
    if (record.expires !== undefined) {
      if (typeof record.expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.expires)) {
        throw new PolicyError(`Exception at index ${index} has an invalid expires date.`);
      }
      exception.expires = record.expires;
    }
    return exception;
  });
}

export function loadExceptionsFile(filePath: string): Exception[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PolicyError(`Could not read exceptions ${filePath}: ${message}`);
  }
  return parseExceptions(parsed);
}

export function exceptionsPath(cwd: string): string {
  return path.join(cwd, "grdrl.exceptions.json");
}

export function policyPath(cwd: string): string {
  return path.join(cwd, "grdrl.json");
}

function parseRule(value: unknown, index: number): RequiredRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PolicyError(`Rule at index ${index} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.trim() === "") {
    throw new PolicyError(`Rule at index ${index} needs an id.`);
  }
  if (record.minSeverity !== "warn" && record.minSeverity !== "error") {
    throw new PolicyError(`Rule ${record.id} minSeverity must be "warn" or "error".`);
  }
  if (!Array.isArray(record.globs) || record.globs.length === 0 || record.globs.some((glob) => typeof glob !== "string" || glob === "")) {
    throw new PolicyError(`Rule ${record.id} needs at least one glob.`);
  }
  return {
    id: record.id,
    minSeverity: record.minSeverity,
    globs: record.globs,
  };
}

function parseLint(value: unknown): NonNullable<Policy["lint"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PolicyError("lint must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.script !== "string" || record.script.trim() === "") {
    throw new PolicyError("lint.script must be a non-empty string.");
  }
  if (typeof record.commandIncludes !== "string" || record.commandIncludes.trim() === "") {
    throw new PolicyError("lint.commandIncludes must be a non-empty string.");
  }
  return { script: record.script, commandIncludes: record.commandIncludes };
}

function parseCi(value: unknown): NonNullable<Policy["ci"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PolicyError("ci must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record.commandIncludes) ||
    record.commandIncludes.length === 0 ||
    record.commandIncludes.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw new PolicyError("ci.commandIncludes must be a non-empty array of strings.");
  }
  const ci: NonNullable<Policy["ci"]> = { commandIncludes: record.commandIncludes };
  if (record.files !== undefined) {
    if (
      !Array.isArray(record.files) ||
      record.files.length === 0 ||
      record.files.some((item) => typeof item !== "string" || item.trim() === "")
    ) {
      throw new PolicyError("ci.files must be a non-empty array of strings.");
    }
    ci.files = record.files;
  }
  return ci;
}
