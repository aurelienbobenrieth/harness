/**
 * Lexical scanning for Alchemy stack sources.
 *
 * Change detectors receive file text, not syntax trees, so the change rules read declarations through two aligned views
 * of the source: `text` keeps string contents and blanks comments, `code` also blanks string contents so brackets
 * balance without a parser. Regular-expression literals are not recognized; a stack file is expected not to need them.
 */
import type { ChangeSet } from "@aurelienbbn/agentlint";

type SourceViews = {
  /** Comments blanked; string and template contents kept. */
  readonly text: string;
  /** Comments and string/template contents blanked; quotes kept. */
  readonly code: string;
};

/** One call found in a source, with its arguments and the `.pipe(...)` calls chained directly on it. */
export type CallSite = {
  /** The matched callee name without its namespace prefix, e.g. `R2.Bucket`. */
  readonly name: string;
  /** One-based line of the callee. */
  readonly line: number;
  /** Top-level argument texts, trimmed. */
  readonly args: readonly string[];
  /** Argument texts of every `.pipe(...)` chained on the call, in order. */
  readonly pipes: readonly string[];
};

export type SourcePair = {
  readonly path: string;
  readonly before: string | undefined;
  readonly after: string | undefined;
};

/** Script files the change rules read. */
export const scriptGlobs: readonly string[] = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];
export const scriptExcludes: readonly string[] = ["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"];

const blank = (character: string): string => (character === "\n" ? "\n" : " ");

function views(source: string): SourceViews {
  let text = "";
  let code = "";
  let index = 0;

  while (index < source.length) {
    const character = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (character === "/" && (next === "/" || next === "*")) {
      const close = next === "/" ? source.indexOf("\n", index) : source.indexOf("*/", index + 2);
      const end = close < 0 ? source.length : next === "/" ? close : close + 2;
      const blanked = source.slice(index, end).replace(/[^\n]/gu, " ");
      text += blanked;
      code += blanked;
      index = end;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const ends = (at: number): boolean => source[at] === character || (character !== "`" && source[at] === "\n");
      let end = index + 1;
      while (end < source.length && !ends(end)) end += source[end] === "\\" ? 2 : 1;
      end = Math.min(end, source.length);
      const closed = source[end] === character;
      const body = source.slice(index + 1, end);
      text += character + body + (closed ? character : "");
      code += character + [...body].map(blank).join("") + (closed ? character : "");
      index = closed ? end + 1 : end;
      continue;
    }

    text += character;
    code += character;
    index++;
  }

  return { text, code };
}

const openers = new Set(["(", "[", "{"]);
const closers = new Set([")", "]", "}"]);

function closingIndex(code: string, open: number): number {
  let depth = 0;
  for (let index = open; index < code.length; index++) {
    const character = code[index] ?? "";
    if (openers.has(character)) depth++;
    else if (closers.has(character) && --depth === 0) return index;
  }
  return -1;
}

/** Offsets of `target` outside every bracket pair, between `start` and `end`. */
function topLevelOffsets(code: string, target: string, start: number, end: number): number[] {
  const offsets: number[] = [];
  let depth = 0;
  for (let index = start; index < end; index++) {
    const character = code[index] ?? "";
    if (openers.has(character)) depth++;
    else if (closers.has(character)) depth--;
    else if (character === target && depth === 0) offsets.push(index);
  }
  return offsets;
}

function splitTopLevel(source: SourceViews, start: number, end: number): string[] {
  const cuts = [start - 1, ...topLevelOffsets(source.code, ",", start, end), end];
  const parts = cuts.slice(1).map((cut, index) => source.text.slice((cuts[index] ?? start - 1) + 1, cut).trim());
  return parts.at(-1) === "" ? parts.slice(0, -1) : parts;
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let cursor = text.indexOf("\n"); cursor >= 0 && cursor < index; cursor = text.indexOf("\n", cursor + 1)) line++;
  return line;
}

const pipePattern = /\s*\.\s*pipe\s*\(/uy;

/**
 * Finds calls whose callee ends with a name matched by `calleeSource`, optionally behind a namespace such as
 * `Cloudflare.` or `Alchemy.`. Calls with unbalanced brackets are skipped.
 */
export function findCalls(source: string, calleeSource: string): CallSite[] {
  const view = views(source);
  const pattern = new RegExp(String.raw`(?<![\w$.])(?:[A-Za-z_$][\w$]*\s*\.\s*)*?(${calleeSource})\s*\(`, "gu");
  const calls: CallSite[] = [];

  for (const match of view.code.matchAll(pattern)) {
    const open = match.index + match[0].length - 1;
    const close = closingIndex(view.code, open);
    if (close < 0) continue;

    const pipes: string[] = [];
    let cursor = close + 1;
    pipePattern.lastIndex = cursor;
    for (let pipe = pipePattern.exec(view.code); pipe; pipe = pipePattern.exec(view.code)) {
      const pipeOpen = cursor + pipe[0].length - 1;
      const pipeClose = closingIndex(view.code, pipeOpen);
      if (pipeClose < 0) break;
      pipes.push(view.text.slice(pipeOpen + 1, pipeClose));
      cursor = pipeClose + 1;
      pipePattern.lastIndex = cursor;
    }

    calls.push({
      name: (match[1] ?? "").replace(/\s+/gu, ""),
      line: lineAt(view.text, match.index),
      args: splitTopLevel(view, open + 1, close),
      pipes,
    });
  }

  return calls;
}

const stringLiteralPattern = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\$]|\\.|\$(?!\{))*)`)$/su;

/** The value of a string literal or substitution-free template, otherwise `undefined`. */
export function stringValue(expression: string): string | undefined {
  const match = stringLiteralPattern.exec(expression.trim());
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : undefined;
}

/** Comparable form of an expression: literal strings by value, anything else by whitespace-collapsed text. */
export function normalizeExpression(expression: string): string {
  const literal = stringValue(expression);
  if (literal !== undefined) return JSON.stringify(literal);
  return expression
    .replace(/'([^'"\\\n]*)'/gu, '"$1"')
    .replace(/\s+/gu, " ")
    .replace(/,?\s*([)\]}])/gu, "$1")
    .replace(/([([{])\s+/gu, "$1")
    .trim();
}

const continuationPattern = /^\s*[.?:|&+\-*/,)\]}]/u;

/**
 * The initializer of the only `const name = ...` in the source, or `undefined` when there is none or more than one.
 * The initializer ends at a top-level `;`, or at a top-level line break the next line does not continue.
 */
export function constInitializer(source: string, name: string): string | undefined {
  const view = views(source);
  const escaped = name.replaceAll("$", String.raw`\$`);
  const pattern = new RegExp(String.raw`(?<![\w$.])const\s+${escaped}(?![\w$])\s*(?::[^=]*)?=(?![=>])\s*`, "gu");
  const declarations = [...view.code.matchAll(pattern)];
  const [declaration] = declarations;
  if (declarations.length !== 1 || declaration === undefined) return undefined;

  const start = declaration.index + declaration[0].length;
  let depth = 0;
  let end = start;
  for (; end < view.code.length; end++) {
    const character = view.code[end] ?? "";
    if (openers.has(character)) depth++;
    else if (closers.has(character)) depth--;
    else if (depth === 0 && character === ";") break;
    else if (depth === 0 && character === "\n" && !continuationPattern.test(view.code.slice(end + 1))) break;
  }
  const initializer = view.text.slice(start, end).trim();
  return initializer === "" ? undefined : initializer;
}

/** Top-level entries of an object literal keyed by property name, or `undefined` when the text is not one. */
export function objectEntries(expression: string): ReadonlyMap<string, string> | undefined {
  const trimmed = expression.trim();
  const view = views(trimmed);
  if (!trimmed.startsWith("{") || closingIndex(view.code, 0) !== trimmed.length - 1) return undefined;

  const entries = new Map<string, string>();
  for (const entry of splitTopLevel(view, 1, trimmed.length - 1)) {
    const entryView = views(entry);
    const colon = topLevelOffsets(entryView.code, ":", 0, entry.length)[0] ?? -1;
    const key = colon < 0 ? entry : entry.slice(0, colon).trim();
    entries.set(stringValue(key) ?? key, colon < 0 ? entry : entry.slice(colon + 1).trim());
  }
  return entries;
}

/**
 * Before and after text of every changed script file. A snapshot the engine could not load fails the detector:
 * missing evidence never counts as a silent pass.
 */
export function changedSources(change: ChangeSet, ruleId: string): SourcePair[] {
  return change.files.map((file) => {
    if ((file.before && file.before.content === undefined) || (file.after && file.after.content === undefined))
      throw new Error(`${ruleId}: missing change snapshot for ${file.path}`);
    return { path: file.path, before: file.before?.content, after: file.after?.content };
  });
}
