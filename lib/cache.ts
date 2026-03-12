import { join } from "node:path";
import { mkdirSync } from "node:fs";

const cacheDir = join(process.cwd(), ".cache");
let dirCreated = false;

export function getCachePath(filename: string): string {
  if (!dirCreated) {
    mkdirSync(cacheDir, { recursive: true });
    dirCreated = true;
  }
  return join(cacheDir, filename);
}
