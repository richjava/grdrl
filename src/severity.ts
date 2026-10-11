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

export function severityName(rank: number): "off" | "warn" | "error" {
  if (rank >= 2) {
    return "error";
  }
  if (rank === 1) {
    return "warn";
  }
  return "off";
}
