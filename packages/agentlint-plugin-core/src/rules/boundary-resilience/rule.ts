/**
 * Flags outbound network calls without a visible timeout or abort signal, and error handlers around
 * those calls that discard the failure.
 *
 * @attribution code-slop by asyrafhussin (MIT, concept re-implemented; real-defenses checklist)
 */
import { type AgentlintNode, defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { codeText, discardsCaughtError, isFunctionNode } from "../ast.js";

const defaultNetworkCallPattern = /^(?:fetch\s*\(|axios[.(]|got[.(]|ky[.(])/;
const resilienceMarkerPattern = /\b(?:signal|timeout|timeoutMs|deadline)\s*[:,})]|\bAbortSignal\b/;

const unboundedCallMessage =
  "Outbound call carries no visible timeout or AbortSignal; an unbounded call hangs the caller.";
const discardedFailureMessage =
  "Handler around an outbound call discards the failure; rethrow it, branch on a named condition, or justify the silence with a REASON: comment.";

export type BoundaryResilienceOptions = {
  /** Pattern matching the start of an outbound network call expression. */
  readonly networkCallPattern?: RegExp;
};

export function defineBoundaryResilience(options: BoundaryResilienceOptions = {}): StateRule {
  options = structuredClone(options);
  const networkCallPattern = options.networkCallPattern ?? defaultNetworkCallPattern;

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "core/boundary-resilience",
      revision: 2,
      title: "Boundary Resilience",
      summary:
        "Flags outbound network calls that show no timeout or AbortSignal, and handlers around them that discard the failure.",
      guidance: {
        standard:
          "Code that talks to the outside world carries the real defenses: an explicit timeout on every outbound call, a deliberate retry policy, idempotency for retried mutations, and unknown errors propagated to observability rather than swallowed.",
        checks: [
          "Every outbound call has a timeout/AbortSignal (or the platform client enforces one).",
          "Retried mutations are idempotent (upsert/idempotency key).",
          "Catch blocks and .catch callbacks around outbound calls either handle a named condition or rethrow — a handler that only logs or returns a default is accepted only with a reason.",
        ],
      },
    },
    binding: {
      id: "core/boundary-resilience",
      authority: "agent",
      include: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
      exclude: ["**/*.d.ts"],
      options: {
        networkCallPattern: options.networkCallPattern
          ? { source: options.networkCallPattern.source, flags: options.networkCallPattern.flags }
          : null,
      },
    },
    detector: {
      fixtures: {
        mustReport: [
          { file: "src/module.ts", source: 'fetch("/api")' },
          { file: "src/module.ts", source: 'fetch("/api/signal?timeout=1")' },
          {
            file: "src/module.ts",
            source: "try { await fetch(url, { signal }); } catch (error) { console.error(error); return []; }",
          },
        ],
        mustStaySilent: [
          { file: "src/module.ts", source: 'fetch("/api", {signal: AbortSignal.timeout(1000)})' },
          {
            file: "src/module.ts",
            source: "try { await fetch(url, { signal }); } catch (error) { throw new LoadError({ cause: error }); }",
          },
        ],
      },
      id: "core/boundary-resilience",
      version: 2,
      scan: "file",
      createOnce(context) {
        const isNetworkCall = (node: AgentlintNode): boolean => {
          networkCallPattern.lastIndex = 0;
          if (!networkCallPattern.test(node.text)) return false;
          const callee = node.childByFieldName("function");

          return !(callee?.descendantsOfType("call_expression") ?? []).some((inner) => {
            networkCallPattern.lastIndex = 0;
            return networkCallPattern.test(inner.text);
          });
        };

        return {
          call_expression(node) {
            if (isNetworkCall(node)) {
              if (resilienceMarkerPattern.test(codeText(node.childByFieldName("arguments") ?? node))) return;
              context.report({ node, message: unboundedCallMessage });
              return;
            }

            const callee = node.childByFieldName("function");
            const target = callee?.childByFieldName("object");
            if (callee?.childByFieldName("property")?.text !== "catch" || !target) return;
            if (![target, ...target.descendantsOfType("call_expression")].some(isNetworkCall)) return;
            const handler = node.childByFieldName("arguments")?.children.find(isFunctionNode);
            const body = handler?.childByFieldName("body");
            if (!handler || !body) return;
            const parameters = handler.childByFieldName("parameters") ?? handler.childByFieldName("parameter");
            const binding =
              parameters?.type === "identifier" ? parameters : parameters?.descendantsOfType("identifier")[0];
            if (!discardsCaughtError(body, binding?.text)) return;

            context.report({ node, message: discardedFailureMessage });
          },
          try_statement(node) {
            const body = node.childByFieldName("body");
            const handler = node.childByFieldName("handler");
            const handlerBody = handler?.childByFieldName("body");
            if (!body || !handler || !handlerBody) return;
            if (!body.descendantsOfType("call_expression").some(isNetworkCall)) return;
            const parameter = handler.childByFieldName("parameter");
            if (parameter !== null && parameter.type !== "identifier") return;
            if (!discardsCaughtError(handlerBody, parameter?.text)) return;

            context.report({ node: handler, message: discardedFailureMessage });
          },
        };
      },
    },
  });
}

export const boundaryResilience = defineBoundaryResilience();
