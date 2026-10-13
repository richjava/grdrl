export type SeverityName = "off" | "warn" | "error";

export type RequiredRule = {
  id: string;
  minSeverity: "warn" | "error";
  globs: string[];
  options?: unknown[];
};

export type Policy = {
  version: number;
  rules: RequiredRule[];
  lint?: {
    script: string;
    commandIncludes: string;
  };
  ci?: {
    commandIncludes: string[];
    files?: string[];
  };
  protectedPaths?: string[];
};

export type Exception = {
  ruleId: string;
  file: string;
  reason: string;
  expires?: string;
};

export type ViolationKind =
  | "rule-missing"
  | "rule-weakened"
  | "scope-narrowed"
  | "options-changed"
  | "suppression"
  | "lint-script"
  | "ci-workflow"
  | "config-unresolved"
  | "exceptions-invalid";

export type Violation = {
  ruleId: string;
  file: string;
  message: string;
  severity: "error";
  kind: ViolationKind;
  line?: number;
};

export type CheckResult = {
  status: "passed" | "failed";
  policyVersion: number;
  violations: Violation[];
};

export type CheckOptions = {
  cwd: string;
  policy: Policy;
  exceptions?: Exception[];
  changedFiles?: ReadonlySet<string> | null;
  today?: string;
};
