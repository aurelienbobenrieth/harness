import { type AstNode, calleeName, identifierName, isFunction, listField, nodeField, walk } from "./ast.js";

/** Which calls open a database transaction. Built-ins are always on; the lists add project openers. */
export interface OpenerNames {
  /** Names called with the transaction's work as their first argument (`atomically(work)`, `db.atomically(work)`). */
  readonly direct: readonly string[];
  /** Names called as `name(scope)(work)` (`ledger.inMerchant(id)(work)`). */
  readonly curried: readonly string[];
}

/** One transaction a file opens: the call, how, and the nodes whose code runs inside. */
export interface TransactionCall {
  readonly call: AstNode;
  readonly opener: string;
  readonly inside: readonly AstNode[];
}

/** Opened with any argument: Effect SQL `sql.withTransaction(effect)` and `effect.pipe(sql.withTransaction)`. */
const ANY_ARGUMENT = ["withTransaction"];
/** Opened only with a function argument: Drizzle, Knex, TypeORM `db.transaction(fn)`, Prisma `$transaction(fn)`. */
const FUNCTION_ARGUMENT = ["transaction", "$transaction"];

/** Whether `text` can contain an opener, so a file without one is never parsed. */
export const mayOpenTransaction = (text: string, names: OpenerNames): boolean =>
  [...ANY_ARGUMENT, ...FUNCTION_ARGUMENT, ...names.direct, ...names.curried].some((name) => text.includes(name));

const argumentsOf = (call: AstNode): readonly AstNode[] => listField(call, "arguments");

/** The transactions `program` opens, in source order. */
export const transactionCallsOf = (program: AstNode, names: OpenerNames): readonly TransactionCall[] => {
  const direct = new Set([...ANY_ARGUMENT, ...names.direct]);
  const curried = new Set(names.curried);
  const found: TransactionCall[] = [];

  const isOpener = (node: AstNode | undefined): string | undefined => {
    const name = calleeName(node);
    if (name !== undefined && direct.has(name)) return `${name}(…)`;
    if (node?.type === "CallExpression") {
      const inner = calleeName(nodeField(node, "callee"));
      if (inner !== undefined && curried.has(inner)) return `${inner}(…)(…)`;
    }
    return undefined;
  };

  walk(program, (node) => {
    if (node.type !== "CallExpression") return;
    const callee = nodeField(node, "callee");
    const args = argumentsOf(node);
    const name = calleeName(callee);
    const [first] = args;

    if (name !== undefined && direct.has(name) && first !== undefined) {
      found.push({ call: node, inside: [first], opener: `${name}(…)` });
    } else if (name !== undefined && FUNCTION_ARGUMENT.includes(name) && isFunction(first)) {
      found.push({ call: node, inside: [first as AstNode], opener: `${name}(…)` });
    } else if (callee?.type === "CallExpression") {
      const inner = calleeName(nodeField(callee, "callee"));
      if (inner !== undefined && curried.has(inner) && first !== undefined) {
        found.push({ call: node, inside: [first], opener: `${inner}(…)(…)` });
      }
    } else if (name === "execute" && callee?.type === "MemberExpression" && isFunction(first)) {
      const subject = nodeField(callee, "object");
      if (subject?.type === "CallExpression" && calleeName(nodeField(subject, "callee")) === "transaction") {
        found.push({ call: node, inside: [first as AstNode], opener: "transaction().execute(…)" });
      }
    }

    const isPipe = name === "pipe" && (callee?.type === "MemberExpression" || identifierName(callee) === "pipe");
    if (isPipe) {
      const index = args.findIndex((argument) => isOpener(argument) !== undefined);
      const opener = index < 0 ? undefined : isOpener(args[index]);
      if (opener !== undefined) {
        const subject = callee?.type === "MemberExpression" ? [nodeField(callee, "object")] : [];
        found.push({
          call: node,
          inside: [...subject, ...args.slice(0, index)].filter((item): item is AstNode => item !== undefined),
          opener: `pipe(${opener.replace("(…)", "")})`,
        });
      }
    }
  });

  return found;
};
