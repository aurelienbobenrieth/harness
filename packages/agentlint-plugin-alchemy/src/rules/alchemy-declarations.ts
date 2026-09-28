/**
 * Alchemy v2 declarations read lexically from stack sources: resource constructors, `Alchemy.Stack` calls and their
 * `.pipe(...)` decorations. Shared by the change rules, which see text rather than syntax trees.
 */
import { constInitializer, findCalls, normalizeExpression, objectEntries, stringValue } from "./source-scan.js";

/**
 * Stateful Cloudflare resources whose deletion loses data. Names are written as they follow the provider namespace:
 * `Cloudflare.R2.Bucket(...)`, `Cloudflare.D1.Database(...)`, `Cloudflare.KV.Namespace(...)`.
 */
export const statefulResources: readonly string[] = ["R2.Bucket", "D1.Database", "KV.Namespace"];

export type ResourceDeclaration = {
  readonly path: string;
  readonly type: string;
  /** The logical ID: a literal's value, or the normalized expression when the ID is computed. */
  readonly id: string;
  readonly props: ReadonlyMap<string, string> | undefined;
  /** Former logical IDs claimed through `renamedFrom(...)` in the declaration's own `.pipe(...)`. */
  readonly renamedFrom: readonly string[];
  /** Piped through `RemovalPolicy.retain()` or `retain(true)`, so every stage keeps the cloud object. */
  readonly retained: boolean;
  /** Argument texts of the `.pipe(...)` calls chained on the declaration. */
  readonly pipes: readonly string[];
  readonly line: number;
  readonly excerpt: string;
};

export type StackDeclaration = {
  readonly path: string;
  readonly name: string;
  /** Normalized `state:` option, or `undefined` when the options object sets none or is not a literal. */
  readonly state: string | undefined;
  readonly line: number;
};

const identifierPattern = /^[A-Za-z_$][\w$]*$/u;
const unconditionalRetainPattern = /(?<![\w$])retain\s*\(\s*(?:true\s*)?\)/u;
const stackCallee = String.raw`Stack(?:\s*<[^()]*>\s*\(\s*\))?`;

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/** Regex source matching any of the given dotted constructor names. */
export function calleeSource(names: readonly string[]): string {
  return names.map((name) => escapeName(name).replace(/\\\./gu, String.raw`\s*\.\s*`)).join("|");
}

function formerIds(pipes: readonly string[]): string[] {
  return pipes.flatMap((pipe) =>
    findCalls(pipe, "renamedFrom").flatMap((call) =>
      call.args.flatMap((argument) => {
        const former = stringValue(argument) ?? stringValue(objectEntries(argument)?.get("fqn") ?? "");
        return former === undefined ? [] : [former];
      }),
    ),
  );
}

/** Resource constructor calls of the given types in one source. */
export function resourceDeclarations(path: string, source: string, types: readonly string[]): ResourceDeclaration[] {
  if (types.length === 0) return [];
  return findCalls(source, calleeSource(types)).flatMap((call) => {
    const [id, propsText] = call.args;
    if (id === undefined) return [];
    const entries = propsText === undefined ? new Map<string, string>() : objectEntries(propsText);
    const props = entries && new Map([...entries].map(([key, value]) => [key, normalizeExpression(value)]));
    return [
      {
        path,
        type: call.name,
        id: stringValue(id) ?? normalizeExpression(id),
        props,
        renamedFrom: formerIds(call.pipes),
        retained: call.pipes.some((pipe) => unconditionalRetainPattern.test(pipe)),
        pipes: call.pipes,
        line: call.line,
        excerpt: `${call.name}(${id})`,
      },
    ];
  });
}

/** `Alchemy.Stack("Name", { providers, state }, effect)` calls, including the `Stack<Self>()(...)` class form. */
export function stackDeclarations(path: string, source: string): StackDeclaration[] {
  return findCalls(source, stackCallee).flatMap((call) => {
    const name = stringValue(call.args[0] ?? "");
    if (name === undefined) return [];
    const option = objectEntries(call.args[1] ?? "")?.get("state");
    // `{ state }` or `state: store` resolves through the file's only `const` of that name.
    const state =
      option !== undefined && identifierPattern.test(option) ? (constInitializer(source, option) ?? option) : option;
    return [{ path, name, state: state === undefined ? undefined : normalizeExpression(state), line: call.line }];
  });
}
