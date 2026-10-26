import { type AgentlintNode, defineRule } from "@aurelienbbn/agentlint";
import { isFunctionNode } from "../ast.js";

const networkCallee = /^(?:fetch|enqueue)$|^(?:axios|client|api|repo|repository|queue)\./;

function named(node: AgentlintNode | null): readonly AgentlintNode[] {
  return (node?.children ?? []).filter((child) => child.isNamed && child.type !== "comment");
}

/** Nested routines execute separately; only a fan-out callback belongs to the reviewed operation. */
function hasIo(node: AgentlintNode, callback = false): boolean {
  if (["string", "template_string", "comment", "regex"].includes(node.type)) return false;
  if (isFunctionNode(node) && !callback) return false;
  if (node.type === "await_expression") return true;
  if (node.type === "call_expression" && networkCallee.test(node.childByFieldName("function")?.text ?? "")) return true;
  return node.children.some((child) => hasIo(child));
}

function fixedCollection(node: AgentlintNode | null): boolean {
  return node?.type === "array" && !node.children.some((child) => child.type === "spread_element");
}

export const boundedWork = defineRule({
  lifecycle: "state",
  standard: {
    id: "core/bounded-work",
    revision: 2,
    title: "Bounded Work",
    summary: "Flags dynamic I/O loops and Promise.all collection fan-out that need a cardinality or concurrency bound.",
    guidance: {
      standard:
        "Dynamic I/O iteration must show a cardinality bound, backpressure, or a deliberate concurrency policy.",
      checks: [
        "Trace the collection's cardinality and the provider's concurrency and rate limits.",
        "Use bounded concurrency or chunked processing when the collection can grow without a fixed maximum.",
        "Fixed sequences, literal batches, and a long but explicit timeout do not establish unbounded work.",
      ],
    },
  },
  binding: {
    id: "core/bounded-work",
    authority: "agent",
    include: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
    exclude: ["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"],
  },
  detector: {
    id: "core/bounded-work",
    version: 2,
    scan: "file",
    fixtures: {
      mustReport: [
        "await Promise.all(items.map(item => client.send(item)))",
        "for (const item of items) { await save(item); }",
      ],
      mustStaySilent: [
        "const values = items.map(item => item.id);",
        "await first(); await second(); await third();",
        "await Promise.all([first, second].map(item => client.send(item)))",
      ],
    },
    createOnce({ context }) {
      const loop = (node: AgentlintNode): void => {
        const body = node.childByFieldName("body");
        if (!body || !hasIo(body)) return;
        if (fixedCollection(node.childByFieldName("right"))) return;
        if (
          /^for\s*\(\s*(?:let|var)\s+(\w+)\s*=\s*\d+\s*;\s*\1\s*<\s*\d+\s*;\s*(?:\1\+\+|\+\+\1)\s*\)/u.test(node.text)
        )
          return;
        context.report({
          node,
          message: "Dynamic I/O loop needs a cardinality bound or backpressure policy.",
        });
      };
      return {
        for_statement: loop,
        for_in_statement: loop,
        while_statement: loop,
        do_statement: loop,
        call_expression(node) {
          if (node.childByFieldName("function")?.text !== "Promise.all") return;
          const collection = named(node.childByFieldName("arguments"))[0];
          if (collection?.type !== "call_expression") return;
          const mapper = collection.childByFieldName("function");
          if (!/^(?:map|flatMap)$/u.test(mapper?.childByFieldName("property")?.text ?? "")) return;
          if (fixedCollection(mapper?.childByFieldName("object") ?? null)) return;
          const callback = named(collection.childByFieldName("arguments")).find(isFunctionNode);
          if (!callback || !hasIo(callback, true)) return;
          context.report({
            node,
            message: "Dynamic Promise.all I/O fan-out needs a cardinality or concurrency bound.",
          });
        },
      };
    },
  },
});
