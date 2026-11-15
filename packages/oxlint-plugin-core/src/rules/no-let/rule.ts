import type { Rule } from "@oxlint/plugins";

const message = "Express the value without reassignment: use const, extract a function, or build it in one expression.";

type Options = {
  readonly allowForLoopHeaders?: boolean;
  readonly allowBranchInitialization?: boolean;
};

// oxlint-disable-next-line typescript/no-explicit-any -- ESTree nodes are walked structurally by key
type AnyNode = { readonly type: string; readonly parent?: AnyNode | null; readonly [key: string]: any };

function visit(node: unknown, visitor: (node: AnyNode) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) visit(child, visitor);
    return;
  }
  if (typeof node !== "object" || node === null || typeof (node as AnyNode).type !== "string") return;
  visitor(node as AnyNode);
  for (const [key, child] of Object.entries(node)) {
    if (key !== "parent") visit(child, visitor);
  }
}

function isTarget(node: AnyNode | null | undefined, name: string): boolean {
  return node?.type === "Identifier" && node["name"] === name;
}

function mentions(node: unknown, name: string): number {
  let count = 0;
  visit(node, (child) => {
    if (isTarget(child, name)) count += 1;
  });
  return count;
}

function writes(node: unknown, name: string): number {
  let count = 0;
  visit(node, (child) => {
    if (child.type === "AssignmentExpression" && isTarget(child["left"], name)) count += 1;
    if (child.type === "UpdateExpression" && isTarget(child["argument"], name)) count += 1;
  });
  return count;
}

function statementsOf(branch: AnyNode): readonly AnyNode[] {
  return branch.type === "BlockStatement" ? (branch["body"] as readonly AnyNode[]) : [branch];
}

function endsAbruptly(statements: readonly AnyNode[]): boolean {
  const last = statements.at(-1);
  return last?.type === "ThrowStatement" || last?.type === "ReturnStatement";
}

function isPlainAssignment(statement: AnyNode, name: string): boolean {
  if (statement.type !== "ExpressionStatement") return false;
  const expression = statement["expression"] as AnyNode;
  return (
    expression.type === "AssignmentExpression" &&
    expression["operator"] === "=" &&
    isTarget(expression["left"], name) &&
    mentions(expression["right"], name) === 0
  );
}

/** One branch assigns the variable exactly once, before any other mention, or ends in `throw`/`return`. */
function branchInitializes(statements: readonly AnyNode[], name: string): boolean {
  const total = writes(statements, name);
  if (total === 0) return mentions(statements, name) === 0 && endsAbruptly(statements);
  if (total !== 1) return false;
  const index = statements.findIndex((statement) => mentions(statement, name) > 0);
  const first = statements[index];
  if (first === undefined) return false;
  if (isPlainAssignment(first, name)) return true;
  return (
    statements.length === index + 1 && completeBranching(first, name) && mentions(first, name) === writes(first, name)
  );
}

/** An `if`/`else` chain ending in `else`, or a `switch` with `default`, whose every branch initializes the variable. */
function completeBranching(statement: AnyNode, name: string): boolean {
  if (statement.type === "IfStatement") {
    const alternate = statement["alternate"] as AnyNode | null;
    if (alternate === null) return false;
    return (
      branchInitializes(statementsOf(statement["consequent"]), name) &&
      (alternate.type === "IfStatement"
        ? completeBranching(alternate, name)
        : branchInitializes(statementsOf(alternate), name))
    );
  }
  if (statement.type === "SwitchStatement") {
    const cases = statement["cases"] as readonly AnyNode[];
    if (!cases.some((entry) => entry["test"] === null)) return false;
    return cases.every((entry, position) => {
      const body = (entry["consequent"] as readonly AnyNode[]).filter((child) => child.type !== "BreakStatement");
      return body.length === 0 && position < cases.length - 1 ? true : branchInitializes(body, name);
    });
  }
  return false;
}

/** `let x;` assigned once in each branch of the next `if`/`else` or `switch`, and only read afterwards. */
function isBranchInitialization(node: AnyNode): boolean {
  const declarations = node["declarations"] as readonly AnyNode[];
  const declarator = declarations[0];
  if (declarations.length !== 1 || declarator === undefined || declarator["init"] !== null) return false;
  const id = declarator["id"] as AnyNode;
  if (id.type !== "Identifier") return false;
  const name = id["name"] as string;

  const holder = node.parent;
  const siblings =
    holder?.type === "Program" || holder?.type === "BlockStatement" || holder?.type === "StaticBlock"
      ? (holder["body"] as readonly AnyNode[])
      : holder?.type === "SwitchCase"
        ? (holder["consequent"] as readonly AnyNode[])
        : undefined;
  if (siblings === undefined) return false;

  const following = siblings.slice(siblings.indexOf(node) + 1);
  const first = following.findIndex((statement) => mentions(statement, name) > 0);
  const branching = following[first];
  if (branching === undefined || !completeBranching(branching, name)) return false;
  return writes(following.slice(first + 1), name) === 0;
}

function isForHeader(node: AnyNode): boolean {
  const parent = node.parent;
  if (parent === undefined || parent === null) return false;
  return (
    (parent.type === "ForStatement" && parent["init"] === node) ||
    ((parent.type === "ForInStatement" || parent.type === "ForOfStatement") && parent["left"] === node)
  );
}

export const noLet: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow let and var declarations in favor of const and expression-oriented code.",
    },
    messages: {
      noLet: message,
    },
    schema: [
      {
        type: "object",
        properties: {
          allowForLoopHeaders: { type: "boolean" },
          allowBranchInitialization: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowForLoopHeaders: false, allowBranchInitialization: false }],
  },
  createOnce(context) {
    return {
      VariableDeclaration(node) {
        if (node.kind !== "let" && node.kind !== "var") return;
        const options = ((context as { readonly options?: readonly unknown[] }).options?.[0] ?? {}) as Options;
        if (node.kind === "let") {
          if (options.allowForLoopHeaders === true && isForHeader(node as unknown as AnyNode)) return;
          if (options.allowBranchInitialization === true && isBranchInitialization(node as unknown as AnyNode)) return;
        }
        context.report({ node, messageId: "noLet" });
      },
    };
  },
};
