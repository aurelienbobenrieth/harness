/** Example consumer wiring; requires a pinned local @tailwindcss/cli installation. */
import { coreConformance } from "@aurelienbbn/conformance-core/vitest";

coreConformance({
  root: process.cwd(),
  closedDesignSystem: {
    stylesheet: "src/styles.css",
    buildCommand: [
      process.execPath,
      "./node_modules/@tailwindcss/cli/dist/index.mjs",
      "--input",
      "{stylesheet}",
      "--output",
      "{output}",
    ],

    // Include these candidates and the forbidden candidates in the probe's @source inline(...).
    requiredSelectors: [".bg-surface", ".text-ink", ".gap-gutter"],

    // This finite sample detects selected token leaks; it is not an exhaustive utility allowlist.
    forbiddenSelectors: [".text-red-500", ".bg-red-500", ".p-4", ".m-2", ".shadow-md", ".rounded-lg"],
  },
});
