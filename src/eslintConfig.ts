import path from "node:path";
import { ESLint } from "eslint";
import { relativePosix, SOURCE_EXTENSIONS, walkFiles } from "./files.js";
import { severityRank } from "./severity.js";

export type ProjectFile = {
  relativePath: string;
  ignored: boolean;
  rules: Map<string, number>;
};

export type ProjectRules =
  | { ok: true; files: ProjectFile[] }
  | { ok: false; message: string };

export type EffectiveRules =
  | { ok: true; byFile: Map<string, number> }
  | { ok: false; message: string };

export async function effectiveRuleSeverity(
  cwd: string,
  files: readonly string[],
  ruleId: string,
): Promise<EffectiveRules> {
  let eslint: ESLint;
  try {
    eslint = new ESLint({ cwd: path.resolve(cwd) });
    const configFile = await eslint.findConfigFile();
    if (!configFile) {
      return { ok: false, message: "Could not find an ESLint flat config." };
    }
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }

  const byFile = new Map<string, number>();
  for (const file of files) {
    const absolute = path.resolve(cwd, file);
    try {
      if (await eslint.isPathIgnored(absolute)) {
        byFile.set(file, 0);
        continue;
      }
      const config = await eslint.calculateConfigForFile(absolute);
      const rules = config && typeof config === "object" ? (config as { rules?: Record<string, unknown> }).rules : undefined;
      byFile.set(file, severityRank(rules?.[ruleId]));
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  }
  return { ok: true, byFile };
}

export async function readProjectRules(cwd: string): Promise<ProjectRules> {
  const root = path.resolve(cwd);
  const relativeFiles = walkFiles(root)
    .map((file) => relativePosix(root, file))
    .filter((file) => SOURCE_EXTENSIONS.has(path.extname(file)));

  let eslint: ESLint;
  try {
    eslint = new ESLint({ cwd: root });
    const configFile = await eslint.findConfigFile();
    if (!configFile) {
      return { ok: false, message: "Could not find an ESLint flat config." };
    }
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }

  const files: ProjectFile[] = [];
  for (const relativePath of relativeFiles) {
    const absolute = path.resolve(root, relativePath);
    try {
      if (await eslint.isPathIgnored(absolute)) {
        files.push({ relativePath, ignored: true, rules: new Map() });
        continue;
      }
      const config = await eslint.calculateConfigForFile(absolute);
      const configured =
        config && typeof config === "object" ? (config as { rules?: Record<string, unknown> }).rules : undefined;
      const rules = new Map<string, number>();
      for (const [ruleId, value] of Object.entries(configured ?? {})) {
        rules.set(ruleId, severityRank(value));
      }
      files.push({ relativePath, ignored: false, rules });
    } catch (error) {
      return { ok: false, message: errorMessage(error) };
    }
  }
  return { ok: true, files };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
