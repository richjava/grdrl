import type { CheckResult } from "./types.js";

export function formatText(result: CheckResult): string {
  const lines = [
    "Policy integrity report",
    result.status === "passed" ? "Passed" : "Failed",
    "",
  ];
  if (result.violations.length === 0) {
    lines.push("Required enforcement still matches the approved policy.");
    return lines.join("\n");
  }
  for (const violation of result.violations) {
    const location = violation.line ? `${violation.file}:${violation.line}` : violation.file;
    lines.push(`${violation.kind} — ${violation.ruleId}`);
    lines.push(`${location}: ${violation.message}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function formatJson(result: CheckResult): string {
  return `${JSON.stringify(
    {
      status: result.status,
      policyVersion: result.policyVersion,
      violations: result.violations,
    },
    null,
    2,
  )}\n`;
}
