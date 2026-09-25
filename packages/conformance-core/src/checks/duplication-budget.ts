/**
 * Runs jscpd (when installed) and fails once the repo exceeds its duplicated-code
 * budget. Without jscpd the check degrades to a warning instead of failing.
 *
 * @attribution desloppify by Peter O'Malley (concept only, no code reuse)
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ConformanceCheck } from "../finding.js";
import { isRecord, listDirectory, parseJson, readTextFile } from "../fs-support.js";
import { excerpt, resolveToolBin, runTool } from "../tool-support.js";

const docs = "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#duplication-budget";

type CloneSide = { readonly name: string; readonly start?: number; readonly end?: number };

function parseCloneSide(value: unknown): CloneSide | undefined {
  if (!isRecord(value) || typeof value["name"] !== "string") return undefined;
  return {
    name: value["name"],
    start: typeof value["start"] === "number" ? value["start"] : undefined,
    end: typeof value["end"] === "number" ? value["end"] : undefined,
  };
}

function formatCloneSide(side: CloneSide | undefined): string {
  if (side === undefined) return "unknown";
  const range = side.start !== undefined && side.end !== undefined ? `:${side.start}-${side.end}` : "";
  return `${side.name}${range}`;
}

async function readReport(reportDirectory: string): Promise<unknown> {
  const preferred = parseJson(await readTextFile(path.join(reportDirectory, "jscpd-report.json")));
  if (preferred !== undefined) return preferred;
  for (const entry of await listDirectory(reportDirectory)) {
    if (!entry.endsWith(".json")) continue;
    const parsed = parseJson(await readTextFile(path.join(reportDirectory, entry)));
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

export const duplicationBudget: ConformanceCheck = {
  id: "duplication-budget",
  description: "Copy-pasted blocks stay within the configured clone budget (jscpd).",
  docs,
  async run({ root, duplication }) {
    const minLines = duplication?.minLines ?? 8;
    const minTokens = duplication?.minTokens ?? 60;
    const maxClones = duplication?.maxClones ?? 0;
    if (
      !Number.isSafeInteger(minLines) ||
      minLines < 1 ||
      !Number.isSafeInteger(minTokens) ||
      minTokens < 1 ||
      !Number.isSafeInteger(maxClones) ||
      maxClones < 0
    )
      return [
        {
          check: "duplication-budget",
          severity: "error",
          evaluation: "failed",
          message: "Set positive integer minLines/minTokens and a nonnegative integer maxClones.",
          docs,
        },
      ];

    const jscpdBin = await resolveToolBin(root, "jscpd");
    if (jscpdBin === undefined) {
      return [
        {
          check: "duplication-budget",
          severity: duplication?.requireTool === true ? "error" : "warning",
          evaluation: "unsupported",
          message: "jscpd not installed — duplication budget skipped; add jscpd to enable.",
          docs,
        },
      ];
    }

    const reportDirectory = await mkdtemp(path.join(tmpdir(), "conformance-core-jscpd-"));
    try {
      const result = await runTool(
        process.execPath,
        [
          jscpdBin,
          root,
          "--reporters",
          "json",
          "--output",
          reportDirectory,
          "--min-lines",
          String(minLines),
          "--min-tokens",
          String(minTokens),
          "--silent",
          "--ignore",
          [
            "**/node_modules/**",
            "**/dist/**",
            "**/coverage/**",
            "**/.git/**",
            ...(duplication?.ignorePatterns ?? []),
          ].join(","),
        ],
        { cwd: root },
      );

      if (result.timedOut) {
        return [
          {
            check: "duplication-budget",
            severity: duplication?.requireTool === true ? "error" : "warning",
            evaluation: "failed",
            message: "jscpd timed out after 120s — duplication budget not evaluated.",
            docs,
          },
        ];
      }

      const report = await readReport(reportDirectory);
      if (
        !isRecord(report) ||
        !Array.isArray(report.duplicates) ||
        !report.duplicates.every(
          (clone) =>
            isRecord(clone) &&
            parseCloneSide(clone.firstFile) !== undefined &&
            parseCloneSide(clone.secondFile) !== undefined,
        )
      ) {
        return [
          {
            check: "duplication-budget",
            severity: duplication?.requireTool === true ? "error" : "warning",
            evaluation: "failed",
            message:
              `jscpd produced no readable JSON report — duplication budget not evaluated. ${excerpt(result.stderr)}`.trim(),
            docs,
          },
        ];
      }

      const duplicates = Array.isArray(report["duplicates"]) ? report["duplicates"] : [];
      if (result.failed && duplicates.length === 0)
        return [
          {
            check: "duplication-budget",
            severity: duplication?.requireTool === true ? "error" : "warning",
            evaluation: "failed",
            message: `jscpd exited unsuccessfully without clone findings: ${excerpt(result.stderr)}`,
            docs,
          },
        ];
      if (duplicates.length <= maxClones) return [];

      const topClones = duplicates
        .slice(0, 3)
        .map((clone) => {
          const record = isRecord(clone) ? clone : {};
          return `${formatCloneSide(parseCloneSide(record["firstFile"]))} <-> ${formatCloneSide(parseCloneSide(record["secondFile"]))}`;
        })
        .join("; ");
      return [
        {
          check: "duplication-budget",
          severity: "error",
          message: `Found ${duplicates.length} duplicated block(s), above the budget of ${maxClones}. Top clones: ${topClones}. Extract shared code or raise duplication.maxClones deliberately.`,
          docs,
        },
      ];
    } finally {
      await rm(reportDirectory, { recursive: true, force: true });
    }
  },
};
