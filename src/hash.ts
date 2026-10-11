import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function hashFile(filePath: string): string | null {
  try {
    const data = readFileSync(filePath);
    return createHash("sha256").update(data).digest("hex");
  } catch {
    return null;
  }
}
