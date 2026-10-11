import type { Exception } from "./types.js";
import { toPosix } from "./files.js";

export function todayUtc(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function exceptionCovers(
  exceptions: readonly Exception[],
  file: string,
  ruleId: string,
  today: string,
): boolean {
  const normalizedFile = toPosix(file);
  return exceptions.some((exception) => {
    if (exception.reason.trim() === "") {
      return false;
    }
    if (exception.expires !== undefined && today > exception.expires) {
      return false;
    }
    if (toPosix(exception.file) !== normalizedFile) {
      return false;
    }
    return exception.ruleId === "*" || exception.ruleId === ruleId;
  });
}
