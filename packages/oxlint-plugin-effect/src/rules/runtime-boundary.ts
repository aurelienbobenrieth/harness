import type { Context, ESTree } from "@oxlint/plugins";
import { parentOf, unwrapExpression } from "@aurelienbbn/oxlint-kit/ast";

/** Handler names the Workers runtime calls on a default-exported module object. */
const workerHandlerNames: ReadonlySet<string> = new Set(["fetch", "scheduled", "queue", "email", "tail", "trace"]);

function propertyName(key: ESTree.Node): string | undefined {
  if (key.type === "Identifier") return key.name;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}

/**
 * Whether `node` sits inside a handler of a default-exported module object (`export default { fetch(request, env) {} }`):
 * the Workers runtime owns that call, so running an Effect to a Promise there is the program boundary.
 */
export function isInsideWorkerHandler(node: ESTree.Node): boolean {
  let current = parentOf(node);
  while (current !== undefined) {
    if ((current.type === "Property" || current.type === "MethodDefinition") && !current.computed) {
      const name = propertyName(current.key);
      const object = parentOf(current);
      if (name !== undefined && workerHandlerNames.has(name) && object?.type === "ObjectExpression") {
        let owner = parentOf(object);
        while (
          owner !== undefined &&
          (owner.type === "TSSatisfiesExpression" ||
            owner.type === "TSAsExpression" ||
            owner.type === "ParenthesizedExpression")
        )
          owner = parentOf(owner);
        if (owner?.type === "ExportDefaultDeclaration") return true;
      }
    }
    current = parentOf(current);
  }
  return false;
}

function isRunMainReference(node: ESTree.Node): boolean {
  const target = unwrapExpression(node.type === "CallExpression" ? node.callee : node);
  return (
    target.type === "MemberExpression" &&
    !target.computed &&
    target.property.type === "Identifier" &&
    target.property.name === "runMain"
  );
}

/**
 * Whether the value of `node` is handed to a platform `runMain` launcher, the process boundary:
 * `NodeRuntime.runMain(program)`, `program.pipe(NodeRuntime.runMain)`, `program.pipe(Layer.launch, BunRuntime.runMain)`.
 */
export function isConsumedByRunMain(node: ESTree.Node): boolean {
  const parent = parentOf(node);
  const value = parent?.type === "CallExpression" && parent.callee === node ? parent : node;
  const consumer = parentOf(value);
  if (consumer?.type === "CallExpression") {
    if (isRunMainReference(consumer.callee) && consumer.arguments.includes(value as ESTree.Expression)) return true;
    return consumer.arguments.some((argument) => isRunMainReference(argument));
  }
  if (consumer?.type === "MemberExpression" && consumer.object === value) {
    const pipe = parentOf(consumer);
    return pipe?.type === "CallExpression" && pipe.callee === consumer && pipe.arguments.some(isRunMainReference);
  }
  return false;
}

const browserEntry = /\b(?:document|window)\.\w|^\s*import\s+["'][^"']+\.css["']/mu;

/**
 * Whether the file is a browser entry point, where the page owns the process lifetime and the entry file is the
 * composition root: it touches `document`/`window` or imports a stylesheet.
 */
export function isBrowserEntry(context: Context): boolean {
  return browserEntry.test(context.sourceCode.text);
}
