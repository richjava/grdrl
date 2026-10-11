import { execFileSync } from "node:child_process";

export function gitShow(cwd: string, ref: string, file: string): string {
  return execFileSync("git", ["show", `${ref}:${file}`], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function gitChangedFiles(cwd: string, ref: string): string[] {
  const output = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", ref, "--"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
