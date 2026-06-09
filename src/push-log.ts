import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, "..", "last-push.json");

export function loadPushedLinks(): Set<string> {
  try {
    const data = fs.readFileSync(LOG_PATH, "utf-8");
    const json = JSON.parse(data);
    return new Set(json.links || []);
  } catch {
    return new Set();
  }
}

export function savePushedLinks(links: string[]): void {
  fs.writeFileSync(
    LOG_PATH,
    JSON.stringify({ links, time: new Date().toISOString() })
  );
}

export function getNewItems(
  items: any[],
  pushed: Set<string>
): { fresh: any[]; pushedCount: number } {
  const fresh = items.filter((item) => !pushed.has(item.link));
  return { fresh, pushedCount: items.length - fresh.length };
}
