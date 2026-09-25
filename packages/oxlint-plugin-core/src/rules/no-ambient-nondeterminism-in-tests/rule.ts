/**
 * @attribution "Eradicating Non-Determinism in Tests" by Martin Fowler (concept)
 */
import type { Context, ESTree, Rule } from "@oxlint/plugins";
import { resolveVariable, unwrapExpression } from "../ast-support.js";
import { isTestFile, type RuleContextWithFilename } from "../filename-support.js";
import { testApi } from "../test-api-support.js";

/** Locale-sensitive methods mapped to the zero-based position of their `locales` argument. */
const localeArgumentIndex = new Map([
  ["toLocaleString", 0],
  ["toLocaleDateString", 0],
  ["toLocaleTimeString", 0],
  ["localeCompare", 1],
]);
const clockControlApis = new Set(["vi.useFakeTimers", "vi.setSystemTime"]);

type ClockReport = { readonly node: ESTree.Node; readonly messageId: "ambientClock"; readonly data: { call: string } };

function isGlobal(context: Context, node: ESTree.Node, name: string): boolean {
  return node.type === "Identifier" && node.name === name && (resolveVariable(context, node)?.defs.length ?? 0) === 0;
}

function isMissing(argument: ESTree.Node | undefined): boolean {
  if (argument === undefined) return true;
  const value = unwrapExpression(argument);
  return value.type === "Identifier" && value.name === "undefined";
}

/** Returns `[object, property]` for a non-computed member callee such as `Date.now`. */
function memberCallee(callee: ESTree.Node): readonly [ESTree.Node, string] | undefined {
  const target = unwrapExpression(callee);
  if (target.type !== "MemberExpression" || target.computed || target.property.type !== "Identifier") return undefined;
  return [unwrapExpression(target.object), target.property.name];
}

function intlFormatterName(context: Context, callee: ESTree.Node): string | undefined {
  const member = memberCallee(callee);
  if (member === undefined || !isGlobal(context, member[0], "Intl")) return undefined;
  return member[1].endsWith("Format") ? `Intl.${member[1]}` : undefined;
}

export const noAmbientNondeterminismInTests: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow test files from depending on the host locale, the real clock, or `Math.random()`: locale-sensitive formatting without a locale, `new Date()` / `Date.now()` / `performance.now()` without fake timers, and unseeded randomness.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowClock: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      ambientLocale:
        '{{call}} without a locale formats with the locale of whichever machine runs the test, so the expectation passes on one host and fails on another. Pass an explicit locale such as "en-US".',
      ambientClock:
        "{{call}} reads the real clock, so this test sees a different value on every run. Freeze time with vi.useFakeTimers() and vi.setSystemTime(...), or pass a fixed date into the code under test.",
      ambientRandom:
        "Math.random() gives this test a different input on every run, so a failure cannot be reproduced. Use a fixed value, or a seeded generator such as fast-check when the randomness is the point.",
    },
  },
  create(context) {
    if (!isTestFile(context as RuleContextWithFilename)) return {};

    const options = context.options[0] as { readonly allowClock?: boolean } | undefined;
    const allowClock = options?.allowClock === true;
    const clockReads: ClockReport[] = [];
    let controlsClock = false;

    const checkFormatter = (node: ESTree.CallExpression | ESTree.NewExpression): void => {
      const name = intlFormatterName(context as Context, node.callee);
      if (name !== undefined && isMissing(node.arguments[0])) {
        context.report({ node, messageId: "ambientLocale", data: { call: `new ${name}()` } });
      }
    };

    return {
      CallExpression(node) {
        const api = testApi(context as Context, node.callee);
        if (api !== undefined && clockControlApis.has(api)) {
          controlsClock = true;
          return;
        }
        checkFormatter(node);
        const member = memberCallee(node.callee);
        if (member === undefined) return;
        const [object, method] = member;

        const localeIndex = localeArgumentIndex.get(method);
        if (localeIndex !== undefined) {
          if (isMissing(node.arguments[localeIndex]) && node.arguments.every((entry) => entry.type !== "SpreadElement"))
            context.report({ node, messageId: "ambientLocale", data: { call: `${method}()` } });
          return;
        }
        if (method === "random" && isGlobal(context as Context, object, "Math")) {
          context.report({ node, messageId: "ambientRandom" });
          return;
        }
        if (method !== "now") return;
        if (isGlobal(context as Context, object, "Date") || isGlobal(context as Context, object, "performance")) {
          clockReads.push({
            node,
            messageId: "ambientClock",
            data: { call: `${(object as ESTree.IdentifierReference).name}.now()` },
          });
        }
      },
      NewExpression(node) {
        checkFormatter(node);
        if (node.arguments.length === 0 && isGlobal(context as Context, unwrapExpression(node.callee), "Date")) {
          clockReads.push({ node, messageId: "ambientClock", data: { call: "new Date()" } });
        }
      },
      "Program:exit"() {
        if (allowClock || controlsClock) return;
        for (const read of clockReads) context.report(read);
      },
    };
  },
};
