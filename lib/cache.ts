import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const cacheDir = join(process.cwd(), ".cache");
let dirCreated = false;

export function getCachePath(filename: string): string {
  if (!dirCreated) {
    mkdirSync(cacheDir, { recursive: true });
    dirCreated = true;
  }
  return join(cacheDir, filename);
}

interface CacheEnvelope<T> {
  timestamp: number;
  data: T;
}

export interface CacheOptions<T> {
  file: string;
  isFresh?: (entry: { timestamp: number; data: T }) => boolean;
  ttlSeconds?: number;
  label?: string;
}

export function createCache<T>(opts: CacheOptions<T>) {
  const path = getCachePath(opts.file);
  const label = opts.label ?? opts.file;
  const isFresh =
    opts.isFresh ??
    (({ timestamp }: { timestamp: number }) =>
      Date.now() / 1000 - timestamp < (opts.ttlSeconds ?? 3600));

  return {
    read(allowStale = false): T | null {
      try {
        if (!existsSync(path)) return null;
        const envelope: CacheEnvelope<T> = JSON.parse(
          readFileSync(path, "utf-8"),
        );
        if (!envelope.data) return null;
        if (allowStale || isFresh(envelope)) return envelope.data;
        return null;
      } catch (err) {
        console.error(`${label} cache read error:`, err);
        return null;
      }
    },
    write(data: T): void {
      try {
        const envelope: CacheEnvelope<T> = {
          timestamp: Date.now() / 1000,
          data,
        };
        writeFileSync(path, JSON.stringify(envelope));
      } catch (err) {
        console.error(`${label} cache write error:`, err);
      }
    },
  };
}
