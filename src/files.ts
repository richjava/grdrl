import { readdirSync } from "node:fs";
import path from "node:path";
import { minimatch } from "minimatch";

export const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  ".next",
  "build",
]);

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function matchesGlob(relativePath: string, pattern: string): boolean {
  const rel = toPosix(relativePath);
  const options = { dot: true, nocase: false };
  if (minimatch(rel, pattern, options)) {
    return true;
  }
  if (pattern.includes("/**/")) {
    return minimatch(rel, pattern.replace("/**/", "/"), options);
  }
  return false;
}

export function matchesAnyGlob(relativePath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(relativePath, pattern));
}

export function walkFiles(cwd: string): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          visit(fullPath);
        }
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  visit(cwd);
  return files;
}

export function relativePosix(cwd: string, filePath: string): string {
  return toPosix(path.relative(cwd, filePath));
}
