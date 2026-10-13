export function severityRank(value: unknown): number {
  if (Array.isArray(value)) {
    return severityRank(value[0]);
  }
  if (value === 0 || value === "off" || value === undefined || value === null) {
    return 0;
  }
  if (value === 1 || value === "warn") {
    return 1;
  }
  if (value === 2 || value === "error") {
    return 2;
  }
  return 0;
}

export function minimumRank(minSeverity: "warn" | "error"): number {
  return minSeverity === "error" ? 2 : 1;
}

export function ruleOptions(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(1);
}

export function sameOptions(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function severityName(rank: number): "off" | "warn" | "error" {
  if (rank >= 2) {
    return "error";
  }
  if (rank === 1) {
    return "warn";
  }
  return "off";
}
