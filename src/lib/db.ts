import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const locks: Map<string, boolean> = new Map();

function acquireLock(filename: string): void {
  const maxRetries = 50;
  let retries = 0;
  while (locks.get(filename) && retries < maxRetries) {
    const waitMs = Math.floor(Math.random() * 10) + 1;
    const end = Date.now() + waitMs;
    while (Date.now() < end) {
      /* spin wait */
    }
    retries++;
  }
  locks.set(filename, true);
}

function releaseLock(filename: string): void {
  locks.delete(filename);
}

export function readJSON<T>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      return [] as unknown as T;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [] as unknown as T;
  }
}

export function writeJSON<T>(filename: string, data: T): void {
  const filePath = path.join(DATA_DIR, filename);
  acquireLock(filename);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    throw error;
  } finally {
    releaseLock(filename);
  }
}
