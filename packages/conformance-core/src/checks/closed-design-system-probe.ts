import postcss from "postcss";
/**
 * Builds CSS and checks the configured required and forbidden selector lists.
 * A finite selector probe does not establish an exhaustive closed set.
 * Only runs when the `closedDesignSystem` option is provided.
 *
 * @attribution ai-automation by Sandro Maglione (inspiration, independently re-implemented)
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile } from "../fs-support.js";
import { excerpt, runTool } from "../tool-support.js";

const docs =
  "https://github.com/aurelienbobenrieth/harness/tree/main/packages/conformance-core#closed-design-system-probe";

export const closedDesignSystemProbe: ConformanceCheck = {
  id: "closed-design-system-probe",
  description: "The built CSS contains every owned token utility and excludes configured forbidden selectors.",
  docs,
  async run({ root, closedDesignSystem }) {
    if (closedDesignSystem === undefined) return [];

    const stylesheetPath = path.resolve(root, closedDesignSystem.stylesheet);
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "conformance-core-theme-"));
    const outputPath = path.join(outputDirectory, "output.css");
    try {
      if (closedDesignSystem.buildCommand === undefined || closedDesignSystem.buildCommand.length === 0)
        return [
          {
            check: "closed-design-system-probe",
            severity: "error",
            evaluation: "failed",
            message:
              "Configure an explicit buildCommand with {stylesheet} and {output}; core has no framework-specific builder.",
            docs,
          },
        ];
      const command = closedDesignSystem.buildCommand.map((part) =>
        part.replaceAll("{stylesheet}", stylesheetPath).replaceAll("{output}", outputPath),
      );

      const result = await runTool(command[0] ?? "", command.slice(1), { cwd: root });
      if (result.timedOut) {
        return [
          {
            check: "closed-design-system-probe",
            severity: "error",
            evaluation: "failed",
            message: "Design-system CSS build timed out after 120s — closed-design-system probe not evaluated.",
            docs,
          },
        ];
      }
      if (result.failed) {
        return [
          {
            check: "closed-design-system-probe",
            severity: "error",
            evaluation: "failed",
            message: `CSS build failed: ${excerpt(result.stderr) || "no stderr output"}`,
            path: closedDesignSystem.stylesheet,
            docs,
          },
        ];
      }

      const css = await readTextFile(outputPath);
      if (css === undefined) {
        return [
          {
            check: "closed-design-system-probe",
            severity: "error",
            evaluation: "failed",
            message: `CSS build produced no output at the expected path: ${excerpt(result.stderr) || "no stderr output"}`,
            path: closedDesignSystem.stylesheet,
            docs,
          },
        ];
      }

      const selectors = new Set<string>();
      try {
        postcss.parse(css).walkRules((rule) => {
          for (const selector of rule.selectors) selectors.add(selector.trim());
        });
      } catch {
        return [
          {
            check: "closed-design-system-probe",
            severity: "error",
            evaluation: "failed",
            message: "Build output is not valid CSS.",
            docs,
          },
        ];
      }
      const findings: ConformanceFinding[] = [];
      for (const selector of closedDesignSystem.requiredSelectors) {
        if (selectors.has(selector)) continue;
        findings.push({
          check: "closed-design-system-probe",
          severity: "error",
          message: `"${selector}" is missing from the built CSS: required token selector absent — theme not producing owned utilities.`,
          path: closedDesignSystem.stylesheet,
          docs,
        });
      }
      for (const selector of closedDesignSystem.forbiddenSelectors) {
        if (!selectors.has(selector)) continue;
        findings.push({
          check: "closed-design-system-probe",
          severity: "error",
          message: `"${selector}" is present in the built CSS: default utility leaked — the theme is not closed; ensure --*: initial and remove the default token source.`,
          path: closedDesignSystem.stylesheet,
          docs,
        });
      }
      return findings;
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  },
};
