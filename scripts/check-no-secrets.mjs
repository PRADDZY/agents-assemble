import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const skip = new Set([".git", "node_modules", "dist", "coverage", ".wrangler"]);
const patterns = [
  /AIza[0-9A-Za-z\-_]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:sk|rk)_[A-Za-z0-9]{20,}\b/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[A-Za-z0-9\-_]{12,}\b/i
];

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const relPath = relative(root, fullPath).replaceAll("\\", "/");
    const content = readFileSync(fullPath, "utf8");

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        offenders.push(relPath);
        break;
      }
    }
  }
}

walk(root);

if (offenders.length > 0) {
  console.error("Potential secrets found in:");
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}

console.log("No obvious secrets detected.");

