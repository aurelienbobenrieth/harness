/**
 * Extracts the module specifiers a JavaScript or TypeScript source imports, without a parser: a small scanner that
 * skips comments, strings, template literals and regular-expression literals so quoted code never counts.
 *
 * It reads `import … from "x"`, `import "x"`, `import("x")`, `require("x")` and `export … from "x"`.
 */

const regexPrecedingCharacters = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";"]);

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\w$]/u.test(character);
}

/** Moves past whitespace and comments. */
function skipTrivia(text: string, start: number): number {
  let index = start;
  for (;;) {
    const character = text[index];
    if (character === undefined) return index;
    if (/\s/u.test(character)) index += 1;
    else if (text.startsWith("//", index)) {
      const end = text.indexOf("\n", index);
      index = end === -1 ? text.length : end;
    } else if (text.startsWith("/*", index)) {
      const end = text.indexOf("*/", index + 2);
      index = end === -1 ? text.length : end + 2;
    } else return index;
  }
}

/** Returns the index after a quoted string starting at `start`; an unterminated string ends at its line. */
function skipString(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\") index += 2;
    else if (character === quote) return index + 1;
    else if (character === "\n") return index;
    else index += 1;
  }
  return text.length;
}

function skipRegex(text: string, start: number): number {
  let index = start + 1;
  let inClass = false;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\") index += 2;
    else if (character === "\n") return index;
    else if (character === "[") {
      inClass = true;
      index += 1;
    } else if (character === "]") {
      inClass = false;
      index += 1;
    } else if (character === "/" && !inClass) return index + 1;
    else index += 1;
  }
  return text.length;
}

/** Returns the index after a template literal starting at the backtick at `start`, expressions included. */
function skipTemplate(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\") index += 2;
    else if (character === "`") return index + 1;
    else if (character === "$" && text[index + 1] === "{") {
      let depth = 1;
      index += 2;
      while (index < text.length && depth > 0) {
        const inner = text[index];
        if (inner === "`") index = skipTemplate(text, index);
        else if (inner === '"' || inner === "'") index = skipString(text, index);
        else {
          if (inner === "{") depth += 1;
          else if (inner === "}") depth -= 1;
          index += 1;
        }
      }
    } else index += 1;
  }
  return text.length;
}

function readWord(text: string, start: number): string {
  let end = start;
  while (isWordCharacter(text[end])) end += 1;
  return text.slice(start, end);
}

function readQuoted(text: string, start: number): string | undefined {
  const quote = text[start];
  if (quote !== '"' && quote !== "'") return undefined;
  const end = skipString(text, start);
  return text[end - 1] === quote && end - 1 > start ? text.slice(start + 1, end - 1) : undefined;
}

/** After `import` or `export … `: skips a binding clause (`a, * as b, { c }`) and returns the specifier that follows `from`. */
function specifierAfterClause(text: string, start: number): string | undefined {
  let index = start;
  let lastWord = "";
  for (;;) {
    index = skipTrivia(text, index);
    const character = text[index];
    if (character === undefined) return undefined;
    if (character === '"' || character === "'")
      return lastWord === "" || lastWord === "from" ? readQuoted(text, index) : undefined;
    if (character === "{") {
      const close = text.indexOf("}", index);
      if (close === -1) return undefined;
      index = close + 1;
      lastWord = "}";
    } else if (character === "," || character === "*") index += 1;
    else if (isWordCharacter(character)) {
      lastWord = readWord(text, index);
      index += lastWord.length;
    } else return undefined;
  }
}

/** Returns every module specifier `text` imports, in source order, duplicates included. */
export function scanImports(text: string): readonly string[] {
  const specifiers: string[] = [];
  const add = (specifier: string | undefined): void => {
    if (specifier !== undefined && specifier !== "") specifiers.push(specifier);
  };
  let index = 0;
  let previous = "";
  while (index < text.length) {
    const character = text[index] ?? "";
    if (text.startsWith("//", index) || text.startsWith("/*", index)) {
      index = skipTrivia(text, index);
    } else if (character === '"' || character === "'") {
      index = skipString(text, index);
      previous = '"';
    } else if (character === "`") {
      index = skipTemplate(text, index);
      previous = '"';
    } else if (character === "/" && regexPrecedingCharacters.has(previous)) {
      index = skipRegex(text, index);
      previous = '"';
    } else if (isWordCharacter(character)) {
      const word = readWord(text, index);
      const after = skipTrivia(text, index + word.length);
      if (previous !== "." && !/^\d/u.test(word)) {
        if (word === "import") {
          if (text[after] === "(") add(readQuoted(text, skipTrivia(text, after + 1)));
          else if (text[after] !== ".") add(specifierAfterClause(text, after));
        } else if (word === "export") {
          const next = readWord(text, after);
          const clauseStart = next === "type" ? skipTrivia(text, after + 4) : after;
          if (text[clauseStart] === "*" || text[clauseStart] === "{") add(specifierAfterClause(text, clauseStart));
        } else if (word === "require" && text[after] === "(") {
          add(readQuoted(text, skipTrivia(text, after + 1)));
        }
      }
      index += word.length;
      previous = word.slice(-1);
    } else {
      if (!/\s/u.test(character)) previous = character;
      index += 1;
    }
  }
  return specifiers;
}
