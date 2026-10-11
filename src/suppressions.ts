export type Suppression = {
  line: number;
  ruleId: string;
  directive: string;
};

const COMMENT = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const ESLINT_DIRECTIVE = /^(eslint-disable-next-line|eslint-disable-line|eslint-disable)\b([\s\S]*)$/;

export function findSuppressions(source: string): Suppression[] {
  const found: Suppression[] = [];

  for (const match of source.matchAll(COMMENT)) {
    const comment = match[0];
    const start = match.index ?? 0;
    const body = comment.startsWith("//") ? comment.slice(2) : comment.slice(2, -2);
    const leading = body.length - body.trimStart().length;
    const trimmed = body.trimStart();
    const line = lineNumber(source, start + 2 + leading);

    if (/^@ts-nocheck\b/.test(trimmed)) {
      found.push({ line, ruleId: "@ts-nocheck", directive: "@ts-nocheck" });
    }
    if (/^@ts-ignore\b/.test(trimmed)) {
      found.push({ line, ruleId: "@ts-ignore", directive: "@ts-ignore" });
    }

    const eslint = ESLINT_DIRECTIVE.exec(trimmed);
    if (!eslint) {
      continue;
    }
    const directive = eslint[1] ?? "eslint-disable";
    for (const ruleId of ruleIds(eslint[2] ?? "")) {
      found.push({ line, ruleId, directive });
    }
  }

  return found;
}

function ruleIds(rest: string): string[] {
  const withoutReason = rest.split("--")[0] ?? "";
  const names = withoutReason
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return names.length > 0 ? names : ["*"];
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}
