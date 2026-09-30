import type { Context, ESTree, Rule } from "@oxlint/plugins";
import {
  binding,
  importedSpecifierName,
  optionsObject,
  stringLiteralValue,
  unwrapExpression,
} from "@aurelienbbn/oxlint-kit/ast";
import { effectMethod, moduleMethod } from "../binding-support.js";

const defaultPattern = String.raw`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`;
const defaultMinSegments = 2;

/** Span constructors whose name is the first argument and whose span options follow it. */
const leadingNameMethods: ReadonlySet<string> = new Set(["fn", "useSpan", "makeSpan", "makeSpanScoped"]);
/** Dual span wrappers: the name is the first argument data-last and the second argument data-first. */
const dualNameMethods: ReadonlySet<string> = new Set(["withSpan", "withSpanScoped"]);
/** Annotation helpers taking a record of keys, or one key and its value. */
const annotationMethods: ReadonlySet<string> = new Set([
  "annotateLogs",
  "annotateLogsScoped",
  "annotateSpans",
  "annotateCurrentSpan",
]);

const rpcPackages: ReadonlySet<string> = new Set(["effect/unstable/rpc", "@effect/rpc"]);
const rpcModules: ReadonlySet<string> = new Set(["effect/unstable/rpc/Rpc", "@effect/rpc/Rpc"]);

type Options = {
  readonly pattern: RegExp;
  readonly keyPattern: RegExp;
  readonly minSegments: number;
  readonly expected: string;
  readonly expectedKey: string;
};

function readOptions(context: Context): Options {
  const options = optionsObject(context);
  const pattern =
    typeof options["pattern"] === "string" && options["pattern"] !== defaultPattern ? options["pattern"] : undefined;
  const keyPattern =
    typeof options["keyPattern"] === "string" && options["keyPattern"] !== defaultPattern
      ? options["keyPattern"]
      : undefined;
  const minSegments =
    typeof options["minSegments"] === "number" && Number.isInteger(options["minSegments"])
      ? Math.max(1, options["minSegments"])
      : defaultMinSegments;
  const segments = `at least ${minSegments} dot-separated segment${minSegments === 1 ? "" : "s"}`;
  return {
    pattern: new RegExp(pattern ?? defaultPattern, "u"),
    keyPattern: new RegExp(keyPattern ?? defaultPattern, "u"),
    minSegments,
    expected:
      pattern === undefined
        ? `lowercase dotted snake_case with ${segments}, like "area.operation"`
        : `match /${pattern}/ with ${segments}`,
    expectedKey: keyPattern === undefined ? 'lowercase dotted snake_case, like "order_id"' : `match /${keyPattern}/`,
  };
}

/** `Rpc` imported from Effect's RPC module (`effect/unstable/rpc`, or `@effect/rpc` on Effect 3); an unbound `Rpc` counts too. */
function isRpcNamespace(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  const variable = binding(context, node, node.name);
  if (variable === undefined) return node.name === "Rpc";
  return variable.defs.some((definition) => {
    if (definition.parent?.type !== "ImportDeclaration") return false;
    const source = String(definition.parent.source.value);
    if (definition.node.type === "ImportNamespaceSpecifier") return rpcModules.has(source);
    if (definition.node.type !== "ImportSpecifier" || !rpcPackages.has(source)) return false;
    const imported = definition.node.imported;
    return imported.type === "Identifier" && imported.name === "Rpc";
  });
}

function isRpcMake(context: Context, callee: ESTree.Node): boolean {
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier")
    return callee.property.name === "make" && isRpcNamespace(context, callee.object);
  return importedSpecifierName(context, callee, (source) => rpcModules.has(source)) === "make";
}

type NamedCall = {
  readonly name: ESTree.Node | undefined;
  readonly spanOptions: ESTree.Node | undefined;
  readonly kind: "span" | "RPC";
};

/** Locate the telemetry name argument (and span options, when any) of a span constructor or `Rpc.make`. */
function namedCall(context: Context, node: ESTree.CallExpression): NamedCall | undefined {
  const [first, second, third] = node.arguments;
  if (isRpcMake(context, node.callee)) return { name: first, spanOptions: undefined, kind: "RPC" };

  const method = effectMethod(context, node.callee);
  if (method !== undefined && leadingNameMethods.has(method)) return { name: first, spanOptions: second, kind: "span" };
  const isDual =
    (method !== undefined && dualNameMethods.has(method)) ||
    moduleMethod(context, node.callee, "Layer") === "withSpan" ||
    moduleMethod(context, node.callee, "Stream") === "withSpan";
  if (!isDual) return undefined;
  const dataFirst =
    stringLiteralValue(first) === undefined &&
    second !== undefined &&
    unwrapExpression(second).type !== "ObjectExpression";
  return dataFirst
    ? { name: second, spanOptions: third, kind: "span" }
    : { name: first, spanOptions: second, kind: "span" };
}

function staticKey(property: ESTree.Node): ESTree.Node | undefined {
  if (property.type !== "Property" || property.computed) return undefined;
  return property.key;
}

function keyText(key: ESTree.Node): string | undefined {
  return key.type === "Identifier" ? key.name : stringLiteralValue(key);
}

/** The keys of an object literal, or of the `attributes` object inside span options. */
function objectKeys(node: ESTree.Node | undefined): readonly ESTree.Node[] {
  const object = node === undefined ? undefined : unwrapExpression(node);
  if (object?.type !== "ObjectExpression") return [];
  return object.properties.flatMap((property) => {
    const key = staticKey(property);
    return key === undefined ? [] : [key];
  });
}

function attributeKeys(spanOptions: ESTree.Node | undefined): readonly ESTree.Node[] {
  const options = spanOptions === undefined ? undefined : unwrapExpression(spanOptions);
  if (options?.type !== "ObjectExpression") return [];
  const attributes = options.properties.find((property) => {
    const key = staticKey(property);
    return key !== undefined && keyText(key) === "attributes";
  });
  return attributes?.type === "Property" ? objectKeys(attributes.value) : [];
}

/** Keys passed to an annotation helper: a record (`({ key })`, `(effect, { key })`) or one key (`("key", v)`, `(effect, "key", v)`). */
function annotationKeys(node: ESTree.CallExpression): readonly ESTree.Node[] {
  const [first, second] = node.arguments;
  if (node.arguments.length === 2 && first !== undefined && stringLiteralValue(first) !== undefined) return [first];
  if (node.arguments.length === 3 && second !== undefined && stringLiteralValue(second) !== undefined) return [second];
  return node.arguments.length === 1 ? objectKeys(first) : objectKeys(second);
}

/**
 * Keep the names that telemetry backends index in one searchable shape: span names (`Effect.fn`, `Effect.withSpan`
 * and the other span constructors) and RPC procedure tags (`Rpc.make`) as lowercase dotted snake_case with at least
 * `<area>.<operation>`, and log and span annotation keys as lowercase dotted snake_case. Only string literals are
 * checked; `no-dynamic-span-name` owns names built at runtime.
 *
 * @attribution executor by Rhys Sullivan, dotted snake_case span and attribute names such as `mcp.auth.verify_api_key` (MIT, naming-style inspiration)
 */
export const telemetryNameFormat: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require literal span names and Rpc.make tags in lowercase dotted snake_case with at least two segments, and log and span annotation keys in lowercase dotted snake_case.",
    },
    messages: {
      name: 'Rename the {{kind}} name "{{name}}" to {{expected}}: tracing backends index it, and one shape keeps it searchable.',
      key: 'Rename the {{kind}} key "{{key}}" to {{expected}}: telemetry backends index it, and one shape keeps it searchable.',
    },
    schema: [
      {
        type: "object",
        properties: {
          pattern: { type: "string" },
          keyPattern: { type: "string" },
          minSegments: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ pattern: defaultPattern, keyPattern: defaultPattern, minSegments: defaultMinSegments }],
  },
  createOnce(context) {
    function checkKeys(keys: readonly ESTree.Node[], kind: string, options: Options): void {
      for (const key of keys) {
        const text = keyText(key);
        if (text === undefined || options.keyPattern.test(text)) continue;
        context.report({ node: key, messageId: "key", data: { kind, key: text, expected: options.expectedKey } });
      }
    }

    return {
      CallExpression(node) {
        const method = effectMethod(context, node.callee);
        if (method !== undefined && annotationMethods.has(method)) {
          const kind = method.startsWith("annotateLogs") ? "log annotation" : "span annotation";
          checkKeys(annotationKeys(node), kind, readOptions(context));
          return;
        }

        const call = namedCall(context, node);
        if (call === undefined) return;
        const options = readOptions(context);
        const name = stringLiteralValue(call.name);
        if (
          call.name !== undefined &&
          name !== undefined &&
          !(options.pattern.test(name) && name.split(".").length >= options.minSegments)
        )
          context.report({
            node: call.name,
            messageId: "name",
            data: { kind: call.kind, name, expected: options.expected },
          });
        checkKeys(attributeKeys(call.spanOptions), "span attribute", options);
      },
    };
  },
};
