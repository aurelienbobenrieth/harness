import { type AgentlintNode, defineRule } from "@aurelienbbn/agentlint";
import { sourceFileGlobs, testFileExcludeGlobs } from "../judgment-support.js";

const dataAccessContextPattern = /(?:^|[^\w])\w*(?:repo|repository|store|dao|client|model|collection)s?(?:[^\w]|$)/i;
const unboundedCalleePattern = /\??\.(?:findMany|findAll|getMany|list|search|query|select)$/;
/** A limit option or builder call whose value is not a numeric literal, `0`, `undefined`, or `null`: it comes from a parameter or input. */
const boundednessMarkerPattern =
  /\b(?:first|take|limit|pageSize|perPage|maxResults)\s*(?:[,}]|:\s*(?!\d|\.\d|-\d|undefined\b|null\b)\S)|\.(?:limit|take)\s*\(\s*(?!\d|\.\d|-\d|undefined\b|null\b)\S/i;
/** SQL `LIMIT` / `FETCH FIRST` / `TOP` whose count is a placeholder (`?`, `$1`, `:limit`, `@limit`) or a template interpolation. */
const sqlLimitPattern = /\b(?:LIMIT|FETCH\s+FIRST|TOP)\s+(?:\(\s*)?(?:\?|\$\{|\$\w+|:\w+|@\w+)/i;
const sqlStringPattern = /^\(\s*(?:sql\s*)?["'`]\s*(?:select|with|show|table|values|explain|call)\b/i;
const callbackArgumentPattern = /^\(\s*(?:async\s*)?(?:function\b|\w+\s*=>|\([^)]*\)\s*(?::[^=]+)?=>)/;

/** The callee text of a call: the `function` field when the tree has it, else the text before the first parenthesis. */
function calleeOf(node: AgentlintNode): string {
  const callee = node.childByFieldName("function");
  if (callee) return callee.text;
  const paren = node.text.indexOf("(");
  return paren < 0 ? node.text : node.text.slice(0, paren);
}

function shouldReportCall(node: AgentlintNode, filename: string): boolean {
  const callee = calleeOf(node);
  const method = unboundedCalleePattern.exec(callee);
  if (!method) return false;
  if (!dataAccessContextPattern.test(callee) && !dataAccessContextPattern.test(filename)) return false;
  let chain = node;
  while (chain.parent?.type === "member_expression" && chain.parent.parent?.type === "call_expression")
    chain = chain.parent.parent;
  const args = chain.text.slice(callee.length);
  if (method[0].endsWith(".query") && !sqlStringPattern.test(args)) return false;
  if (method[0].endsWith(".select") && callbackArgumentPattern.test(args)) return false;

  return !boundednessMarkerPattern.test(args) && !sqlLimitPattern.test(args);
}

export const boundedDataAccess = defineRule({
  lifecycle: "state",
  standard: {
    id: "core/bounded-data-access",
    revision: 2,
    title: "Bounded Data Access",
    summary: "Flags repository-like list/search/query calls whose bound is not supplied by the caller.",
    guidance: {
      standard:
        "Repository-like list, search, and query calls must take their limit, page size, or cursor from a parameter or input, so pagination is visible in the interface. A hard-coded limit inside the implementation does not count.",
      checks: [
        "Calls are acceptable when the limit or cursor comes from a parameter or input (SQL placeholders, interpolation, or a non-literal limit/take), or the result is proven tiny.",
        "A literal LIMIT or take in the implementation does not count: it fixes one query and hides the bound from callers; expose limit and cursor in the function's contract.",
        "Filtering that determines result size belongs in the query, not after an unbounded read.",
        "Large reads use limits, page sizes, cursors, or chunked processing.",
      ],
    },
  },
  binding: {
    id: "core/bounded-data-access",
    authority: "agent",
    include: [...sourceFileGlobs],
    exclude: ["**/*.d.ts", ...testFileExcludeGlobs],
  },
  detector: {
    fixtures: {
      mustReport: [
        { file: "src/module.ts", source: "client.users.findMany({})" },
        { file: "src/module.ts", source: "client.users.findMany({take:10})" },
        { file: "src/module.ts", source: "client.query(`SELECT id FROM users LIMIT 100`)" },
      ],
      mustStaySilent: [
        { file: "src/module.ts", source: "client.users.findMany({take:pageSize})" },
        { file: "src/module.ts", source: "client.query(`SELECT id FROM users LIMIT ?`, [limit])" },
      ],
    },
    id: "core/bounded-data-access",
    version: 2,
    scan: "file",
    createOnce({ context }) {
      return {
        call_expression(node) {
          if (!shouldReportCall(node, context.path)) return;

          context.report({
            node,
            message:
              "Repository-like data access has no caller-supplied limit or page size, and a hard-coded bound hides pagination inside the implementation. Expose limit and cursor in the function's contract and pass them here.",
          });
        },
      };
    },
  },
});
