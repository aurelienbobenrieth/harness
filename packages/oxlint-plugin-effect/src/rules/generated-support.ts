import type { Context } from "@oxlint/plugins";
import { getFilename, type RuleContextWithOptions } from "./runtime-support.js";

const generatedFilename = /(?:^|[\\/])(?:generated|__generated__)[\\/]|(?:^|[\\/.-])(?:generated|gen)\.[cm]?[jt]sx?$/iu;
const generatedMarker = /@generated|auto-?generated|do not edit|code generated/iu;
const HEADER_LENGTH = 400;

/**
 * Whether the linted file is machine-written: a `generated/` folder, a `generated.ts` or `*.gen.ts` name, or a header
 * comment (`@generated`, "auto-generated", "DO NOT EDIT"). Rules that police naming or layout of authored code skip
 * these files, since the generator, not the author, owns the shape.
 */
export function isGeneratedFile(context: Context): boolean {
  if (generatedFilename.test(getFilename(context as RuleContextWithOptions))) return true;
  return generatedMarker.test(context.sourceCode.getText().slice(0, HEADER_LENGTH));
}
