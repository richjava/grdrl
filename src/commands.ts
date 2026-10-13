import { readFileSync } from "node:fs";
import path from "node:path";
import { matchesAnyGlob, toPosix } from "./files.js";
import type { Violation } from "./types.js";

export const DEFAULT_CI_GLOBS = [
  ".github/workflows/**/*.yml",
  ".github/workflows/**/*.yaml",
  ".gitlab-ci.yml",
  "bitbucket-pipelines.yml",
];

export type CiScan = {
  paths: string[];
  text: string | null;
  globs: readonly string[];
};

const RUNNERS = new Set(["npx", "npm", "yarn", "pnpm", "node"]);

export function scriptRunsCommand(script: string, needle: string): boolean {
  const segments = script.split(/&&|\|\||[;\n|]/);
  return segments.some((segment) => segmentInvokes(shellTokens(segment), needle));
}

function shellTokens(segment: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of segment.matchAll(pattern)) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return tokens;
}

function segmentInvokes(tokens: string[], needle: string): boolean {
  let index = 0;
  while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index] ?? "")) {
    index += 1;
  }
  if (index >= tokens.length) {
    return false;
  }
  const relevant = tokens.slice(index);
  const base = commandBasename(relevant[0] ?? "");
  if (RUNNERS.has(base)) {
    const args = relevant.slice(1).filter((token) => !token.startsWith("-"));
    if (args.some((token) => tokenMatches(token, needle))) {
      return true;
    }
    const tail = args.join(" ");
    return tail === needle || tail.startsWith(`${needle} `);
  }
  if (tokenMatches(relevant[0] ?? "", needle)) {
    return true;
  }
  const joined = relevant.join(" ");
  return joined === needle || joined.startsWith(`${needle} `);
}

function tokenMatches(token: string, needle: string): boolean {
  const normalized = token.replaceAll("\\", "/");
  const base = commandBasename(normalized);
  const stem = base.replace(/\.(?:js|mjs|cjs)$/, "");
  return normalized === needle || base === needle || stem === needle;
}

function commandBasename(token: string): string {
  const normalized = token.replaceAll("\\", "/");
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

export function lintScriptViolations(
  cwd: string,
  lint: { script: string; commandIncludes: string },
): Violation[] {
  const file = "package.json";
  const fullPath = path.join(cwd, file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(fullPath, "utf8"));
  } catch {
    return [
      {
        ruleId: "lint.script",
        file,
        message: `Required lint script "${lint.script}" could not be read from package.json.`,
        severity: "error",
        kind: "lint-script",
      },
    ];
  }

  const scripts =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { scripts?: unknown }).scripts
      : undefined;
  const command =
    scripts && typeof scripts === "object" && !Array.isArray(scripts)
      ? (scripts as Record<string, unknown>)[lint.script]
      : undefined;

  if (typeof command !== "string" || !scriptRunsCommand(command, lint.commandIncludes)) {
    return [
      {
        ruleId: "lint.script",
        file,
        message: `Script "${lint.script}" must run "${lint.commandIncludes}" as a command.`,
        severity: "error",
        kind: "lint-script",
      },
    ];
  }
  return [];
}

export function ciViolations(commandIncludes: readonly string[], scan: CiScan): Violation[] {
  const where = scan.paths.length > 0 ? scan.paths.join(", ") : scan.globs.join(", ");
  if (scan.text === null) {
    return commandIncludes.map((command) => ({
      ruleId: "ci.workflow",
      file: where,
      message: `No CI config contains "${command}".`,
      severity: "error" as const,
      kind: "ci-workflow" as const,
    }));
  }

  const text = scan.text;
  return commandIncludes
    .filter((command) => !text.includes(command))
    .map((command) => ({
      ruleId: "ci.workflow",
      file: where,
      message: `CI config does not contain "${command}".`,
      severity: "error" as const,
      kind: "ci-workflow" as const,
    }));
}

export function readCiFiles(cwd: string, files: readonly string[], globs: readonly string[] = DEFAULT_CI_GLOBS): CiScan {
  const paths = files
    .map((file) => toPosix(file))
    .filter((file) => matchesAnyGlob(file, globs))
    .sort();
  if (paths.length === 0) {
    return { paths, text: null, globs };
  }
  return {
    paths,
    text: paths.map((file) => readFileSync(path.join(cwd, file), "utf8")).join("\n"),
    globs,
  };
}
