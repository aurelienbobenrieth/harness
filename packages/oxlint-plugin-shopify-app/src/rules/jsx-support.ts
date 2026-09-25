import type { ESTree } from "@oxlint/plugins";

export type StaticValue =
  | { readonly kind: "missing" | "unknown" }
  | { readonly kind: "known"; readonly value: unknown };

const missing: StaticValue = { kind: "missing" };
const unknown: StaticValue = { kind: "unknown" };

function matchesAttribute(candidate: string, name: string): boolean {
  return (
    candidate === name ||
    candidate === name.toLowerCase() ||
    candidate === name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  );
}

/** Evaluate only syntax whose value cannot depend on the surrounding program. */
export function staticValue(node: ESTree.Node | null | undefined): StaticValue {
  if (node === null || node === undefined) return missing;
  if (node.type === "Literal") return { kind: "known", value: node.value };
  if (node.type === "JSXEmptyExpression") return { kind: "known", value: undefined };
  if (node.type === "JSXExpressionContainer") return staticValue(node.expression);
  if (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression" || node.type === "TSNonNullExpression")
    return staticValue(node.expression);
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return { kind: "known", value: node.quasis[0]?.value.cooked ?? "" };
  if (node.type === "UnaryExpression" && node.operator === "void") return { kind: "known", value: undefined };
  return unknown;
}

function spreadAttribute(node: ESTree.Node, name: string): StaticValue {
  if (node.type !== "ObjectExpression") return unknown;
  for (const property of node.properties.toReversed()) {
    if (property.type === "SpreadElement") {
      const value = spreadAttribute(property.argument, name);
      if (value.kind !== "missing") return value;
    } else if (property.type === "Property") {
      const key =
        !property.computed && property.key.type === "Identifier" ? property.key.name : staticValue(property.key);
      if (typeof key !== "string" && key.kind !== "known") return unknown;
      const text = typeof key === "string" ? key : key.value;
      if (typeof text === "string" && matchesAttribute(text, name)) return staticValue(property.value);
    }
  }
  return missing;
}

/** Resolve an effective JSX property, respecting explicit and spread override order. */
export function attribute(opening: ESTree.JSXOpeningElement, name: string): StaticValue {
  for (const entry of opening.attributes.toReversed()) {
    if (entry.type === "JSXSpreadAttribute") {
      const value = spreadAttribute(entry.argument, name);
      if (value.kind !== "missing") return value;
    } else if (entry.name.type === "JSXIdentifier" && matchesAttribute(entry.name.name, name)) {
      return entry.value === null ? { kind: "known", value: true } : staticValue(entry.value);
    }
  }
  return missing;
}

/** Return intrinsic JSX element names; component aliases remain outside static contracts. */
export function elementName(opening: ESTree.JSXOpeningElement): string | undefined {
  return opening.name.type === "JSXIdentifier" ? opening.name.name : undefined;
}

/** Unknown expressions remain review inputs, while known empty or non-string labels fail. */
export function potentiallyNonemptyString(value: StaticValue): boolean {
  return (
    value.kind === "unknown" || (value.kind === "known" && typeof value.value === "string" && value.value.trim() !== "")
  );
}

/** Flatten fragments without treating conditional or component-rendered children as unconditional DOM. */
export function directElements(element: ESTree.JSXElement | ESTree.JSXFragment): readonly ESTree.JSXElement[] {
  return element.children.flatMap((child) =>
    child.type === "JSXElement" ? [child] : child.type === "JSXFragment" ? directElements(child) : [],
  );
}

/** Detect potentially meaningful content without guessing what user components or expressions render. */
export function potentiallyNamedChildren(element: ESTree.JSXElement | ESTree.JSXFragment): boolean {
  return element.children.some((child) => {
    if (child.type === "JSXText") return child.value.trim() !== "";
    if (child.type === "JSXFragment") return potentiallyNamedChildren(child);
    if (child.type === "JSXExpressionContainer") {
      if (child.expression.type === "JSXEmptyExpression") return false;
      const value = staticValue(child.expression);
      return (
        value.kind === "unknown" ||
        (value.kind === "known" &&
          ((typeof value.value === "string" && value.value.trim() !== "") || typeof value.value === "number"))
      );
    }
    if (child.type === "JSXElement") {
      const name = elementName(child.openingElement);
      if (name === "s-icon") return false;
      return true;
    }
    return true;
  });
}
