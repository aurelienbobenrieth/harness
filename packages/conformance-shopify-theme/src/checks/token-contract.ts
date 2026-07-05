import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";

const docs = "https://github.com/aurelienbbn/harness#conformance-shopify-theme";
const defaultPrefixes = ["--theme-", "--scheme-"];

function tokenPatterns(prefixes: readonly string[]): { emitted: RegExp; consumed: RegExp } {
  const alternation = prefixes.map((prefix) => prefix.replace(/^--/, "")).join("|");
  return {
    emitted: new RegExp(`(--(?:${alternation})[\\w-]+)\\s*:`, "g"),
    consumed: new RegExp(`var\\(\\s*(--(?:${alternation})[\\w-]+)`, "g"),
  };
}

export const tokenContract: ConformanceCheck = {
  id: "token-contract",
  description: "Every consumed theme token var() is emitted somewhere, and emitted tokens are consumed.",
  docs,
  async run({ root, tokenPrefixes }) {
    const findings: ConformanceFinding[] = [];
    const { emitted, consumed } = tokenPatterns(tokenPrefixes ?? defaultPrefixes);

    const emittedTokens = new Set<string>();
    const consumedTokens = new Map<string, string>();

    const files = await walkFiles(root, { extensions: [".liquid", ".css"], maxDepth: 4 });
    for (const file of files) {
      const relativePath = path.relative(root, file).replaceAll(path.sep, "/");
      if (relativePath.startsWith("assets/")) continue; // built output duplicates sources
      const content = (await readTextFile(file)) ?? "";
      for (const match of content.matchAll(emitted)) {
        if (match[1] !== undefined) emittedTokens.add(match[1]);
      }
      for (const match of content.matchAll(consumed)) {
        if (match[1] !== undefined && !consumedTokens.has(match[1])) consumedTokens.set(match[1], relativePath);
      }
    }

    for (const [token, firstUse] of consumedTokens) {
      if (emittedTokens.has(token)) continue;
      findings.push({
        check: "token-contract",
        severity: "error",
        message: `${token} is consumed (first seen in ${firstUse}) but never emitted by the token engine.`,
        path: firstUse,
        docs,
      });
    }

    for (const token of emittedTokens) {
      if (consumedTokens.has(token)) continue;
      findings.push({
        check: "token-contract",
        severity: "warning",
        message: `${token} is emitted but never consumed: dead token or missing usage.`,
        docs,
      });
    }

    return findings;
  },
};
