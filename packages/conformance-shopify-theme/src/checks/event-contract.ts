import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile, walkFiles } from "../fs-support.js";
import { parseJson } from "../liquid-support.js";

const docs = "https://shopify.dev/docs/storefronts/themes/best-practices/standard-events-and-actions";
const defaultEventsPath = "frontend/features/storefront-events/events.json";
const customEventPattern = /new CustomEvent\(\s*["']([^"']+)["']/g;
const listenerPattern = /(?:add|remove)EventListener\(\s*["']([^"':]+:[^"']+)["']/g;

type EventsContract = {
  readonly events?: readonly { readonly name?: string }[];
};

export const eventContract: ConformanceCheck = {
  id: "event-contract",
  description: "Every dispatched or listened namespaced event exists in the machine-readable events.json.",
  docs,
  async run({ root, eventsPath }) {
    const findings: ConformanceFinding[] = [];
    const contractPath = eventsPath ?? defaultEventsPath;
    const contractContent = await readTextFile(path.join(root, contractPath));
    if (contractContent === undefined) {
      findings.push({
        check: "event-contract",
        severity: "error",
        message: `${contractPath} is missing: the event vocabulary must be machine-readable.`,
        docs,
      });
      return findings;
    }

    const contract = parseJson<EventsContract>(contractContent);
    const declared = new Set(
      (contract?.events ?? []).map((event) => event.name).filter((name): name is string => typeof name === "string"),
    );
    if (declared.size === 0) {
      findings.push({
        check: "event-contract",
        severity: "error",
        message: `${contractPath} declares no events.`,
        path: contractPath,
        docs,
      });
      return findings;
    }

    const used = new Set<string>();
    const frontendRoot = path.join(root, "frontend");
    for (const sourceFile of await walkFiles(frontendRoot, { extensions: [".ts", ".js"], maxDepth: 5 })) {
      if (sourceFile.endsWith(".test.ts")) continue;
      const relativePath = path.relative(root, sourceFile).replaceAll(path.sep, "/");
      const content = (await readTextFile(sourceFile)) ?? "";

      for (const pattern of [customEventPattern, listenerPattern]) {
        for (const match of content.matchAll(pattern)) {
          const name = match[1];
          if (name === undefined || !name.includes(":")) continue;
          used.add(name);
          if (declared.has(name)) continue;
          findings.push({
            check: "event-contract",
            severity: "error",
            message: `${relativePath} uses event "${name}" which is not declared in ${contractPath}.`,
            path: relativePath,
            docs,
          });
        }
      }
    }

    for (const name of declared) {
      if (used.has(name)) continue;
      findings.push({
        check: "event-contract",
        severity: "warning",
        message: `${contractPath} declares event "${name}" that no frontend code dispatches or listens to.`,
        path: contractPath,
        docs,
      });
    }

    return findings;
  },
};
