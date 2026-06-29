import { defineRule } from "@aurelienbbn/agentlint";

const dataAccessContextPattern = /(?:^|[^\w])\w*(?:repo|repository|store|dao|client|model|collection)s?(?:[^\w]|$)/i;
const unboundedMethodPattern = /\.(?:findMany|findAll|getMany|list|search|query|select)\s*\(/;
const boundednessMarkerPattern =
  /\b(?:first|take|limit|pageSize|perPage|maxResults|cursor|after|before|where\s*:\s*{[^}]*\bid\b|id\s*:)\b|\.limit\s*\(|\.take\s*\(|\.slice\s*\(/i;

function shouldReviewCall(text: string, filename: string): boolean {
  const hasDataAccessContext = dataAccessContextPattern.test(text) || dataAccessContextPattern.test(filename);
  if (!hasDataAccessContext) return false;
  if (!unboundedMethodPattern.test(text)) return false;

  return !boundednessMarkerPattern.test(text);
}

export const boundedDataAccess = defineRule({
  id: "core/bounded-data-access",
  description: "Flags repository-like list/search/query calls without obvious boundedness markers.",
  guidance:
    "Review the flagged data-access call for boundedness. Accept it when the call is proven tiny, paginated, cursor-based, ID-scoped, or explicitly limited. For true positives, add a limit/page size/cursor contract, move filtering into the query, or split the work into bounded chunks. Treat this as a review trigger because ORM and API naming conventions vary by project.",
  createOnce(context) {
    return {
      call_expression(node) {
        if (!shouldReviewCall(node.text, context.getFilename())) return;

        context.report({
          node,
          message: "Repository-like data access has no obvious limit, page size, cursor, or ID bound.",
        });
      },
    };
  },
});
