/**
 * Flags example-only test files that cover an inverse pair or an idempotent normaliser.
 *
 * @attribution "Choosing properties for property-based testing" by Scott Wlaschin (concept: inverse and idempotence families)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import {
  isTestCall,
  literalText,
  matches,
  namedChildren,
  serializePattern,
  sourceGlobs,
  testFilePattern,
} from "../judgment-support-b.js";

/** Two prefix patterns; names pair up when what follows each prefix is identical (`encodeCursor`/`decodeCursor`). */
export type InversePairPattern = readonly [forward: RegExp, backward: RegExp];

const defaultPairPatterns: readonly InversePairPattern[] = [
  [/^encode/, /^decode/],
  [/^serialize/, /^deserialize/],
  [/^(?:stringify|format|print|serialize)/, /^parse/],
  [/^to(?=[A-Z])/, /^from(?=[A-Z])/],
  [/^pack/, /^unpack/],
  [/^compress/, /^decompress/],
  [/^encrypt/, /^decrypt/],
  [/^escape/, /^unescape/],
  [/^marshal/, /^unmarshal/],
];
const defaultIdempotentPattern = /^(?:normalize|canonicali[sz]e|sanitize|dedupe|uniq|sort|slugify|clamp)/;
const defaultPropertyApiPattern =
  /\bfc\.|fast-check|\b(?:it|test)\.prop\b|\.prop\(|Arbitrary|verifyLosslessTransformation/;
const minExampleTests = 3;
const relativeSpecifierPattern = /^\.\.?\//;

export type PropertyTestOpportunityOptions = {
  /** Prefix pairs that mark two imports of one module as inverses. Providing this REPLACES the built-in list. */
  readonly pairPatterns?: readonly InversePairPattern[];
  /** Pattern matching imported names of idempotent operations. */
  readonly idempotentPattern?: RegExp;
  /** Pattern whose presence anywhere in the file shows a property-based API is already in use. */
  readonly propertyApiPattern?: RegExp;
};

type Import = {
  readonly name: string;
  readonly specifier: string;
  readonly statement: AgentlintNode;
};

function relativeValueImports(root: AgentlintNode): readonly Import[] {
  const imports: Import[] = [];
  for (const statement of root.childrenByType("import_statement")) {
    if (statement.children.some((child) => child.type === "type")) continue;
    const source = statement.childByFieldName("source");
    const specifier = source ? literalText(source) : undefined;
    if (specifier === undefined || !relativeSpecifierPattern.test(specifier)) continue;
    for (const imported of statement.descendantsOfType("import_specifier")) {
      if (imported.children.some((child) => child.type === "type")) continue;
      const name = imported.childByFieldName("name") ?? namedChildren(imported)[0];
      if (name) imports.push({ name: name.text, specifier, statement });
    }
  }
  return imports;
}

function remainder(pattern: RegExp, name: string): string | undefined {
  pattern.lastIndex = 0;
  const match = pattern.exec(name);
  return match ? name.slice(0, match.index) + name.slice(match.index + match[0].length) : undefined;
}

export function definePropertyTestOpportunity(options: PropertyTestOpportunityOptions = {}): StateRule {
  options = structuredClone(options);
  const pairPatterns = options.pairPatterns ?? defaultPairPatterns;
  const idempotentPattern = options.idempotentPattern ?? defaultIdempotentPattern;
  const propertyApiPattern = options.propertyApiPattern ?? defaultPropertyApiPattern;

  function inversePair(imports: readonly Import[]): readonly [Import, Import] | undefined {
    for (const forward of imports)
      for (const backward of imports) {
        if (forward.name === backward.name || forward.specifier !== backward.specifier) continue;
        for (const [forwardPattern, backwardPattern] of pairPatterns) {
          const subject = remainder(forwardPattern, forward.name);
          if (subject !== undefined && subject === remainder(backwardPattern, backward.name))
            return [forward, backward];
        }
      }
    return undefined;
  }

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/property-test-opportunity",
      revision: 1,
      title: "Property Test Opportunity",
      summary:
        "Flags test files that cover an encode/decode-style inverse pair or an idempotent normaliser with examples only, where one property would cover the open input domain.",
      guidance: {
        standard:
          "A lossless pair obeys one law (decoding what was encoded gives the input back) and an idempotent operation another (applying it twice changes nothing). A handful of examples samples such a law at the points the author thought of; a property states it once and lets generated inputs look for the counter-example.",
        checks: [
          "FAIL when the input domain is open (strings, numbers, nested or user-controlled data), the law holds by contract (lossless pair, idempotent normaliser) and no property for it exists anywhere in the package. Search for the function names next to a property API first; a hit is a PASS, cite the path.",
          "PASS when the transform is lossy by design: state what is lost; examples are the right tool to pin that.",
          "PASS when the domain is a small closed set that the examples already enumerate exhaustively.",
          "PASS when the functions are one-line delegates to a library codec that owns the law.",
          "PASS once, with the reason recorded, when no property library is installed and project policy is not to add one (check package.json).",
        ],
        examples: [
          {
            label: "FAIL",
            code: 'import { decodeCursor, encodeCursor } from "./cursor";\n\nit("round-trips a first page", () => {\n  expect(decodeCursor(encodeCursor({ page: 1 }))).toEqual({ page: 1 });\n});',
            description: "Cursors carry arbitrary filter strings; one hand-picked value says little.",
          },
          {
            label: "PASS",
            code: 'import fc from "fast-check";\nimport { decodeCursor, encodeCursor } from "./cursor";\n\nit("decodes what it encoded", () => {\n  fc.assert(fc.property(cursorArbitrary, (cursor) => expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)));\n});',
            description: "The law is stated once over generated cursors.",
          },
        ],
        refs: [
          { type: "skill", id: "test-strategy" },
          {
            type: "url",
            href: "https://fsharpforfunandprofit.com/posts/property-based-testing-2/",
          },
          {
            type: "url",
            href: "https://fast-check.dev/docs/introduction/what-is-property-based-testing/",
          },
          { type: "url", href: "https://www.hillelwayne.com/post/pbt-contracts/" },
        ],
      },
    },
    binding: {
      id: "core/property-test-opportunity",
      authority: "agent",
      include: [...sourceGlobs],
      exclude: ["**/*.d.ts"],
      options: {
        pairPatterns: options.pairPatterns
          ? options.pairPatterns.map(([forward, backward]) => [serializePattern(forward), serializePattern(backward)])
          : null,
        idempotentPattern: serializePattern(options.idempotentPattern),
        propertyApiPattern: serializePattern(options.propertyApiPattern),
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          {
            file: "src/cursor.test.ts",
            source:
              'import { encodeCursor, decodeCursor } from "./cursor";\nit("round-trips", () => { expect(decodeCursor(encodeCursor({ page: 1 }))).toEqual({ page: 1 }); });',
          },
        ],
        mustStaySilent: [
          {
            file: "src/cursor.test.ts",
            source:
              'import { parse } from "./reader";\nimport { format } from "./writer";\nit("round-trips", () => { expect(parse(format(1))).toBe(1); });',
          },
        ],
      },
      id: "core/property-test-opportunity",
      version: 1,
      scan: "file",
      createOnce({ context }) {
        return {
          program(root) {
            if (!testFilePattern.test(context.path)) return;
            if (matches(propertyApiPattern, context.source)) return;
            const imports = relativeValueImports(root);

            const pair = inversePair(imports);
            if (pair) {
              const names = [pair[0].name, pair[1].name];
              context.report({
                node: pair[0].statement,
                message: `\`${names[0]}\` and \`${names[1]}\` are inverses tested by examples only; state the round-trip as one property over generated inputs, or show that the transform is lossy or its domain closed.`,
                evidence: { pair: names },
              });
              return;
            }

            const idempotent = imports.find((imported) => matches(idempotentPattern, imported.name));
            if (!idempotent) return;
            if (root.descendantsOfType("call_expression").filter(isTestCall).length < minExampleTests) return;
            context.report({
              node: idempotent.statement,
              message: `\`${idempotent.name}\` is tested by examples only; state that applying it twice equals applying it once as a property over generated inputs, or show that its domain is closed.`,
              evidence: { idempotent: [idempotent.name] },
            });
          },
        };
      },
    },
  });
}

export const propertyTestOpportunity = definePropertyTestOpportunity();
