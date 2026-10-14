/**
 * Require duration strings in delayed transitions and timeouts to use a
 * format XState v6 parses, unless they name a delay declared in the file.
 */
import {
  parentOf,
  propertyKeyName,
  stringLiteralValue,
  unwrapExpressionKeepingChain,
} from "@aurelienbbn/oxlint-kit/ast";
import { importsFrom } from "../ast.js";
import { isInsideConfigArgument, xstateImport } from "../v6-support.js";
import type { ESTree, Rule } from "@oxlint/plugins";

const message =
  '"{{duration}}" is neither a delay declared in delays nor a duration XState parses, so the timer {{failure}}. Write milliseconds (300000), "<n>ms", "<n>s", or ISO 8601 ("PT5M"), or declare the name in delays.';

const isoPart = String.raw`(\d+(?:[.,]\d+)?)`;

const isoDuration = new RegExp(
  `^P(?:${isoPart}W)?(?:${isoPart}D)?(?:T(?:${isoPart}H)?(?:${isoPart}M)?(?:${isoPart}S)?)?$`,
  "i",
);

/**
 * The string formats the v6 delay parser accepts after trimming: whole
 * milliseconds (`500ms`), seconds with an optional fraction (`1.5s`), and ISO 8601
 * durations made of weeks, days, hours, minutes, and seconds (`PT1M30S`).
 */
export function isParsableDuration(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d+ms$/i.test(trimmed) || /^\d*\.?\d*s$/i.test(trimmed)) return true;
  const iso = isoDuration.exec(trimmed);
  return iso !== null && iso.slice(1).some((part) => part !== undefined);
}

/** Strings written as a duration attempt: a leading digit or dot, or an ISO 8601 `P<digit>` / `PT<digit>` start. */
function looksLikeDuration(value: string): boolean {
  return /^\s*(?:[\d.]|P\d|PT\d)/i.test(value);
}

type Candidate = {
  readonly node: ESTree.Node;
  readonly duration: string;
  readonly failure: string;
  readonly namesApply: boolean;
};

const machineTimerFailure = "puts the actor in status 'error' when the state is entered";

function keyText(property: ESTree.Node): string | undefined {
  if (property.type !== "Property" || property.computed) return undefined;
  if (property.key.type === "Literal" && typeof property.key.value === "string") return property.key.value;
  return undefined;
}

export const validDuration: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require after keys, state timeouts, and createAsyncLogic timeouts written as duration strings to use a format XState parses, unless they name a declared delay.",
    },
    messages: {
      validDuration: message,
    },
    schema: [],
  },
  createOnce(context) {
    let enabled = false;
    let candidates: Candidate[] = [];
    let declared = new Set<string>();

    function consider(node: ESTree.Node, duration: string, failure: string, namesApply: boolean): void {
      if (!looksLikeDuration(duration) || isParsableDuration(duration)) return;
      candidates.push({ node, duration, failure, namesApply });
    }

    return {
      Program(node) {
        enabled = importsFrom(node, ["xstate", "@xstate/effect"]);
        candidates = [];
        declared = new Set();
      },
      Property(node) {
        if (!enabled) return;
        const key = propertyKeyName(node);
        const value = unwrapExpressionKeepingChain(node.value);
        if (key === "delays" && value.type === "ObjectExpression") {
          for (const delay of value.properties) {
            const name = delay.type === "Property" ? propertyKeyName(delay) : undefined;
            if (name !== undefined) declared.add(name);
          }
          return;
        }
        if (key === "after" && value.type === "ObjectExpression") {
          if (!isInsideConfigArgument(context, node)) return;
          for (const delayed of value.properties) {
            const text = keyText(delayed);
            // `after` keys that read as numbers are millisecond delays.
            if (text === undefined || !Number.isNaN(Number(text))) continue;
            if (delayed.type === "Property") consider(delayed.key, text, machineTimerFailure, true);
          }
          return;
        }
        if (key !== "timeout") return;
        const duration = stringLiteralValue(value);
        if (duration === undefined) return;
        if (isInsideConfigArgument(context, node)) {
          consider(value, duration, machineTimerFailure, true);
          return;
        }
        const options = parentOf(node);
        const call = options?.type === "ObjectExpression" ? parentOf(options) : undefined;
        if (
          call?.type === "CallExpression" &&
          call.arguments[0] === options &&
          xstateImport(context, call.callee) === "createAsyncLogic"
        )
          consider(value, duration, "is silently dropped and the logic never times out", false);
      },
      "Program:exit"() {
        for (const candidate of candidates) {
          if (candidate.namesApply && declared.has(candidate.duration)) continue;
          context.report({
            node: candidate.node,
            messageId: "validDuration",
            data: { duration: candidate.duration, failure: candidate.failure },
          });
        }
      },
    };
  },
};
