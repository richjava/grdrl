#!/usr/bin/env node
import path from "node:path";
import { checkProject } from "./check.js";
import { gitChangedFiles, gitShow } from "./git.js";
import { initProject } from "./init.js";
import { loadExceptionsFile, loadPolicyFile, parsePolicy, PolicyError } from "./policy.js";
import { formatJson, formatText } from "./report.js";

const USAGE = `Usage: grdrl init [--cwd dir]
       grdrl check [--cwd dir] [--policy file] [--policy-ref git-ref] [--changed-since git-ref] [--format text|json]`;

type CliOptions = {
  command: string;
  cwd: string;
  format: "text" | "json";
  policy?: string;
  policyRef?: string;
  changedSince?: string;
};

function main(): void {
  try {
    const argv = process.argv.slice(2);
    const command = argv[0] ?? "";
    if (command === "init") {
      const cwd = parseCwd(argv.slice(1));
      runInit(cwd).catch((error: unknown) => {
        failClosed(error);
      });
      return;
    }
    if (command !== "check") {
      failUsage(USAGE);
    }
    const options = parseArgs(argv);
    runCheck(options).catch((error: unknown) => {
      failClosed(error);
    });
  } catch (error) {
    failClosed(error);
  }
}

async function runInit(cwd: string): Promise<void> {
  const report = await initProject(cwd);
  process.stdout.write(`Wrote ${report.policyPath}\n${report.notes.join("\n")}\n`);
}

async function runCheck(options: CliOptions): Promise<void> {
  const policy = options.policyRef
    ? parsePolicy(JSON.parse(gitShow(options.cwd, options.policyRef, "grdrl.json")))
    : loadPolicyFile(options.policy ?? path.join(options.cwd, "grdrl.json"));

  const exceptionFile = path.join(options.cwd, "grdrl.exceptions.json");
  let exceptions;
  try {
    exceptions = loadOptionalExceptions(exceptionFile);
  } catch (error) {
    if (error instanceof PolicyError) {
      const result = {
        status: "failed" as const,
        policyVersion: policy.version,
        violations: [
          {
            ruleId: "exceptions.file",
            file: "grdrl.exceptions.json",
            message: error.message,
            severity: "error" as const,
            kind: "exceptions-invalid" as const,
          },
        ],
      };
      writeResult(options.format, result);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const changedFiles = options.changedSince
    ? new Set(gitChangedFiles(options.cwd, options.changedSince))
    : null;

  const result = await checkProject({
    cwd: options.cwd,
    policy,
    exceptions,
    changedFiles,
  });
  writeResult(options.format, result);
  process.exitCode = result.status === "passed" ? 0 : 1;
}

function loadOptionalExceptions(filePath: string) {
  try {
    return loadExceptionsFile(filePath);
  } catch (error) {
    if (error instanceof PolicyError && /Could not read exceptions/.test(error.message) && /ENOENT/.test(error.message)) {
      return [];
    }
    throw error;
  }
}

function writeResult(format: "text" | "json", result: Parameters<typeof formatText>[0]): void {
  const text = format === "json" ? formatJson(result) : `${formatText(result)}\n`;
  process.stdout.write(text);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: argv[0] ?? "",
    cwd: process.cwd(),
    format: "text",
  };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--cwd") {
      options.cwd = path.resolve(requireValue(argv, index, "--cwd"));
      index += 1;
    } else if (arg === "--policy") {
      options.policy = path.resolve(requireValue(argv, index, "--policy"));
      index += 1;
    } else if (arg === "--policy-ref") {
      options.policyRef = requireValue(argv, index, "--policy-ref");
      index += 1;
    } else if (arg === "--changed-since") {
      options.changedSince = requireValue(argv, index, "--changed-since");
      index += 1;
    } else if (arg === "--format") {
      const format = requireValue(argv, index, "--format");
      if (format !== "text" && format !== "json") {
        throw new PolicyError('--format must be "text" or "json".');
      }
      options.format = format;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      failUsage(USAGE);
    } else {
      throw new PolicyError(`Unknown argument ${arg}`);
    }
  }
  return options;
}

function parseCwd(argv: string[]): string {
  let cwd = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--cwd") {
      cwd = path.resolve(requireValue(argv, index, "--cwd"));
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      failUsage(USAGE);
    } else {
      throw new PolicyError(`Unknown argument ${arg}`);
    }
  }
  return cwd;
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new PolicyError(`${flag} requires a value.`);
  }
  return value;
}

function failUsage(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function failClosed(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

main();
