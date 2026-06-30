import { defineRule } from "@aurelienbbn/agentlint";

const dataAccessContextPattern =
  /(?:^|[^\w])\w*(?:repo|repository|store|dao|client|model|collection)s?(?:[^\w]|$)/i;
const unboundedMethodPattern = /\.(?:findMany|findAll|getMany|list|search|query|select)\s*\(/;
const boundednessMarkerPattern =
  /\b(?:first|take|limit|pageSize|perPage|maxResults|cursor|after|before|where\s*:\s*{[^}]*\bid\b|id\s*:)\b|\.limit\s*\(|\.take\s*\(|\.slice\s*\(/i;

function shouldReportCall(text: string, filename: string): boolean {
  const hasDataAccessContext =
    dataAccessContextPattern.test(text) || dataAccessContextPattern.test(filename);
  if (!hasDataAccessContext) return false;
  if (!unboundedMethodPattern.test(text)) return false;

  return !boundednessMarkerPattern.test(text);
}

export const boundedDataAccess = defineRule({
  id: "core/bounded-data-access",
  description: "Flags repository-like list/search/query calls without obvious boundedness markers.",
  guidance: {
    standard:
      "Repository-like list, search, and query calls must show a limit, page or cursor contract, ID scope, or another explicit boundedness proof.",
    checks: [
      "Calls are acceptable when they are proven tiny, paginated, cursor-based, ID-scoped, or explicitly limited.",
      "Filtering that determines result size belongs in the query, not after an unbounded read.",
      "Large reads use limits, page sizes, cursors, or chunked processing.",
    ],
  },
  createOnce(context) {
    return {
      call_expression(node) {
        if (!shouldReportCall(node.text, context.getFilename())) return;

        context.report({
          node,
          message:
            "Repository-like data access has no obvious limit, page size, cursor, or ID bound.",
        });
      },
    };
  },
});
