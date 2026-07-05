import path from "node:path";
import { contrastRatio, parseHexColor } from "../color-support.js";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { readTextFile } from "../fs-support.js";
import { parseJson } from "../liquid-support.js";

const docs = "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html";
const backgroundKeyPattern = /background|bg\b/i;
const foregroundKeyPattern = /text|foreground|heading/i;

type SettingsData = {
  readonly current?: {
    readonly color_schemes?: Record<string, { readonly settings?: Record<string, unknown> }>;
  };
};

export const contrastGuard: ConformanceCheck = {
  id: "contrast-guard",
  description: "Every color scheme's text/background pairs meet the WCAG contrast minimum at build time.",
  docs,
  async run({ root, contrastMinRatio }) {
    const findings: ConformanceFinding[] = [];
    const minRatio = contrastMinRatio ?? 4.5;

    const content = await readTextFile(path.join(root, "config", "settings_data.json"));
    if (content === undefined) return findings;
    const schemes = parseJson<SettingsData>(content)?.current?.color_schemes;
    if (schemes === undefined) return findings;

    for (const [schemeId, scheme] of Object.entries(schemes)) {
      const settings = scheme.settings ?? {};
      const backgrounds: [string, readonly [number, number, number]][] = [];
      const foregrounds: [string, readonly [number, number, number]][] = [];

      for (const [key, value] of Object.entries(settings)) {
        if (typeof value !== "string") continue;
        const color = parseHexColor(value);
        if (color === undefined) continue;
        if (backgroundKeyPattern.test(key)) backgrounds.push([key, color]);
        else if (foregroundKeyPattern.test(key)) foregrounds.push([key, color]);
      }

      for (const [backgroundKey, backgroundColor] of backgrounds) {
        for (const [foregroundKey, foregroundColor] of foregrounds) {
          const ratio = contrastRatio(backgroundColor, foregroundColor);
          if (ratio >= minRatio) continue;
          findings.push({
            check: "contrast-guard",
            severity: "error",
            message: `color scheme "${schemeId}": ${foregroundKey} on ${backgroundKey} is ${ratio.toFixed(2)}:1, below ${minRatio}:1.`,
            path: "config/settings_data.json",
            docs,
          });
        }
      }
    }

    return findings;
  },
};
