import { defineRule } from "@aurelienbbn/agentlint";

const dataAccessContextPattern = /(?:^|[^\w])\w*(?:repo|repository|store|dao|client|model|collection)s?(?:[^\w]|$)/i;
const unboundedMethodPattern = /\.(?:findMany|findAll|getMany|list|search|query|select)\s*\(/;
const boundednessMarkerPattern =
  /\b(?:first|take|limit|pageSize|perPage|maxResults)\s*:\s*(?!0\b|undefined\b|null\b)\S|\.(?:limit|take)\s*\(\s*(?!0\b|undefined\b|null\b)\S/i;

function shouldReportCall(text: string, filename: string): boolean {
  const hasDataAccessContext = dataAccessContextPattern.test(text) || dataAccessContextPattern.test(filename);
  if (!hasDataAccessContext) return false;
  if (!unboundedMethodPattern.test(text)) return false;

  return !boundednessMarkerPattern.test(text);
}

export const boundedDataAccess = defineRule({
  lifecycle: "state",
  standard: {
    id: "core/bounded-data-access",
    revision: 1,
    title: "Bounded Data Access",
    summary: "Flags repository-like list/search/query calls without obvious boundedness markers.",
    guidance: {
      standard:
        "Repository-like list, search, and query calls must show a limit, page or cursor contract, ID scope, or another explicit boundedness proof.",
      checks: [
        "Calls are acceptable when they are proven tiny, paginated, cursor-based, ID-scoped, or explicitly limited.",
        "Filtering that determines result size belongs in the query, not after an unbounded read.",
        "Large reads use limits, page sizes, cursors, or chunked processing.",
      ],
    },
  },
  binding: {
    id: "core/bounded-data-access",
    authority: "agent",
    include: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
    exclude: ["**/*.d.ts"],
  },
  detector: {
    fixtures: {
      mustReport: [{ file: "src/module.ts", source: "client.users.findMany({})" }],
      mustStaySilent: [{ file: "src/module.ts", source: "client.users.findMany({take:10})" }],
    },
    id: "core/bounded-data-access",
    version: 1,
    scan: "file",
    createOnce({ context }) {
      return {
        call_expression(node) {
          if (!shouldReportCall(node.text, context.path)) return;

          context.report({
            node,
            message:
              "Repository-like data access has no visible positive limit or page-size bound; verify result cardinality.",
          });
        },
      };
    },
  },
});
