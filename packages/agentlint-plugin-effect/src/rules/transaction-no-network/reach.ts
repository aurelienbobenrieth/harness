import { createHash } from "node:crypto";
import { type AstNode, field, identifierName, nodeField, listField, walk } from "./ast.js";
import type { Declaration, Program } from "./program.js";

/** What makes code wait on the network, beyond global `fetch`. All matching is by name. */
export interface NetworkSinks {
  /** Import specifiers (`stripe`, `@acme/mailer`) or repository path prefixes (`src/clients`) that talk to the network. */
  readonly modules: readonly string[];
  /** Service or function names that talk to the network whatever their implementation. */
  readonly services: readonly string[];
}

/** One link of the path from a transaction to a sink. */
export interface Step {
  readonly file: string;
  readonly name: string;
  readonly start: number;
  readonly end: number;
}

/** A network sink a transaction reaches, with the path to it, outermost first. */
export interface Sink {
  readonly kind: "fetch" | "http-client" | "module" | "service" | "provider";
  readonly what: string;
  readonly path: readonly Step[];
}

const HTTP_LIBRARIES = new Set([
  "axios",
  "got",
  "ky",
  "undici",
  "node-fetch",
  "cross-fetch",
  "ofetch",
  "superagent",
  "node:http",
  "node:https",
  "http",
  "https",
]);
const HTTP_CLIENT_MODULE = /^(?:effect\/(?:unstable\/)?http|@effect\/platform[\w-]*)(?:\/|$)/u;
const SDK_MODULES = [
  "@aws-sdk/client-",
  "@slack/",
  "@sendgrid/",
  "@octokit/",
  "@anthropic-ai/sdk",
  "@shopify/admin-api-client",
  "stripe",
  "resend",
  "nodemailer",
  "twilio",
  "openai",
  "posthog-node",
];
const MAX_DECLARATIONS = 400;
const MAX_SINKS = 4;

const isTestPath = (file: string): boolean =>
  /(?:^|\/)(?:__tests__|__mocks__|tests?|testing|fixtures?|e2e)\/|\.(?:test|spec|bench|stories)\.[cm]?[jt]sx?$|(?:^|\/)(?:testing|test-[\w-]+)\.[cm]?[jt]sx?$|\.d\.ts$/u.test(
    file,
  );

const matchesModule = (target: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => target === pattern || target.startsWith(pattern.endsWith("/") ? pattern : `${pattern}/`));

const sdkModule = (specifier: string): boolean =>
  SDK_MODULES.some((sdk) =>
    sdk.endsWith("-") || sdk.endsWith("/")
      ? specifier.startsWith(sdk)
      : specifier === sdk || specifier.startsWith(`${sdk}/`),
  );

const httpClientImport = (specifier: string, member: string): boolean =>
  HTTP_LIBRARIES.has(specifier) || (HTTP_CLIENT_MODULE.test(specifier) && /HttpClient/u.test(`${specifier}/${member}`));

const SERVICE_SUPERCLASS = /\b(?:Service|Tag|GenericTag|Reference|ServiceMap)\b/u;
const SERVICE_INITIALIZER = /\b(?:GenericTag|Context\.(?:Tag|Service)|ServiceMap\.|Effect\.Service)\b/u;

const isServiceDeclaration = (node: AstNode, text: string): boolean => {
  if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
    const parent = nodeField(node, "superClass");
    return parent !== undefined && SERVICE_SUPERCLASS.test(text.slice(parent.start, parent.end));
  }
  if (node.type === "VariableDeclarator") {
    const init = nodeField(node, "init");
    return init !== undefined && SERVICE_INITIALIZER.test(text.slice(init.start, init.end));
  }
  return false;
};

interface Pending {
  readonly file: string;
  readonly node: AstNode;
  readonly path: readonly Step[];
}

/** Provider call sites (`Layer.effect(Service, …)`) of services, indexed once per workspace member. */
const providerIndexes = new WeakMap<Program, ReturnType<typeof createProviderIndex>>();

const providerIndex = (program: Program) => {
  let index = providerIndexes.get(program);
  if (index === undefined) {
    index = createProviderIndex(program);
    providerIndexes.set(program, index);
  }
  return index;
};

const createProviderIndex = (program: Program) => {
  const indexes = new Map<string, Map<string, string[]>>();
  const LAYER_CALL = /\bLayer\.\w+\s*(?:<[^()]*?>)?\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/gu;
  const indexOf = (member: string): Map<string, string[]> => {
    let index = indexes.get(member);
    if (index === undefined) {
      index = new Map();
      for (const file of program.repo.list(member)) {
        if (isTestPath(file)) continue;
        const text = program.repo.read(file) ?? "";
        for (const match of text.matchAll(LAYER_CALL)) {
          const name = (match[1] ?? "").split(".").at(-1) ?? "";
          const files = index.get(name) ?? [];
          if (files.at(-1) !== file) files.push(file);
          index.set(name, files);
        }
      }
      indexes.set(member, index);
    }
    return index;
  };

  const declaredBy = (file: string, argument: AstNode): Declaration | undefined => {
    const module = program.module(file);
    if (module === undefined) return undefined;
    const direct = identifierName(argument);
    const name =
      direct ?? (argument.type === "MemberExpression" ? identifierName(nodeField(argument, "property")) : undefined);
    if (name === undefined) return undefined;
    const local = direct === undefined ? undefined : module.top.get(direct);
    if (local !== undefined) return { file, name: direct ?? name, node: local };
    const base = direct ?? identifierName(nodeField(argument, "object"));
    const imported = base === undefined ? undefined : module.imports.get(base);
    const target = imported && program.resolve(file, imported.from);
    return imported && target
      ? program.declaration(target, direct === undefined ? name : imported.imported)
      : undefined;
  };

  return (service: Declaration, member: string): readonly Pending[] => {
    const providers: Pending[] = [];
    for (const file of indexOf(member).get(service.name) ?? []) {
      const module = program.module(file);
      if (module === undefined) continue;
      for (const statement of module.body) {
        walk(statement, (node) => {
          if (node.type !== "CallExpression") return;
          const callee = nodeField(node, "callee");
          const layerCall =
            callee?.type === "MemberExpression" && identifierName(nodeField(callee, "object")) === "Layer";
          const [first] = listField(node, "arguments");
          if (!layerCall || first === undefined) return;
          const target = declaredBy(file, first);
          if (target?.file === service.file && target.name === service.name) {
            providers.push({
              file,
              node,
              path: [{ end: node.end, file, name: `provided in ${file}`, start: node.start }],
            });
          }
        });
      }
    }
    return providers;
  };
};

/**
 * Everything the `start` nodes of `file` reach inside its workspace member, and the network sinks among it.
 * Name-based and static: a callback passed as a parameter, a method on an object built elsewhere or a dynamic
 * import is not followed. Reads at most 400 declarations.
 */
export const reachNetwork = (input: {
  readonly program: Program;
  readonly file: string;
  readonly start: readonly AstNode[];
  readonly sinks: NetworkSinks;
}): readonly Sink[] => {
  const { program, sinks } = input;
  const member = program.repo.memberOf(input.file);
  const providersOf = providerIndex(program);
  const found = new Map<string, Sink>();
  const seen = new Set<string>();
  const queue: Pending[] = input.start.map((node) => ({ file: input.file, node, path: [] }));
  const services = new Set(sinks.services);
  const inMember = (file: string): boolean => program.repo.memberOf(file) === member && !isTestPath(file);

  const record = (sink: Sink): void => {
    const key = `${sink.kind}:${sink.what}`;
    if (!found.has(key)) found.set(key, sink);
  };

  const enter = (declaration: Declaration, path: readonly Step[]): void => {
    const here: Step = {
      end: declaration.node.end,
      file: declaration.file,
      name: declaration.name,
      start: declaration.node.start,
    };
    if (services.has(declaration.name)) {
      record({ kind: "service", path: [...path, here], what: declaration.name });
      return;
    }
    const id = `${declaration.file}#${declaration.name}`;
    if (seen.has(id) || seen.size >= MAX_DECLARATIONS || !inMember(declaration.file)) return;
    seen.add(id);
    queue.push({ file: declaration.file, node: declaration.node, path: [...path, here] });
    const text = program.module(declaration.file)?.text ?? "";
    if (isServiceDeclaration(declaration.node, text)) {
      for (const provider of providersOf(declaration, member)) {
        const providerId = `${provider.file}@${provider.node.start}`;
        if (!seen.has(providerId)) {
          seen.add(providerId);
          queue.push({ ...provider, path: [...path, here, ...provider.path] });
        }
      }
    }
  };

  const importSink = (
    file: string,
    local: string,
    reference: { readonly member: string | undefined },
    path: readonly Step[],
  ): void => {
    const binding = program.module(file)?.imports.get(local);
    if (binding === undefined || binding.typeOnly) return;
    const resolved = program.resolve(file, binding.from);
    const memberName = binding.imported === "*" ? (reference.member ?? "") : binding.imported;
    const label = binding.from;
    const step: Step = { end: 0, file, name: local, start: 0 };
    if (services.has(memberName) || services.has(local)) {
      record({ kind: "service", path: [...path, step], what: memberName || local });
    } else if (
      matchesModule(binding.from, sinks.modules) ||
      (resolved !== undefined && matchesModule(resolved, sinks.modules))
    ) {
      record({ kind: "module", path: [...path, step], what: label });
    } else if (httpClientImport(binding.from, memberName)) {
      record({ kind: "http-client", path: [...path, step], what: label });
    } else if (sdkModule(binding.from)) {
      record({ kind: "module", path: [...path, step], what: label });
    } else if (resolved !== undefined) {
      const declaration = program.declaration(resolved, memberName === "" ? "default" : memberName);
      if (declaration !== undefined) enter(declaration, path);
    }
  };

  for (let index = 0; index < queue.length && found.size < MAX_SINKS; index += 1) {
    const pending = queue[index];
    if (pending === undefined) continue;
    const module = program.module(pending.file);
    if (module === undefined) continue;
    walk(pending.node, (node, slot) => {
      if (node.type === "MemberExpression" && field(node, "computed") !== true) {
        const object = identifierName(nodeField(node, "object"));
        const property = identifierName(nodeField(node, "property"));
        if (object === "globalThis" && property === "fetch") {
          record({ kind: "fetch", path: pending.path, what: "global fetch" });
        }
      }
      if (node.type !== "Identifier" || !slot.reference) return;
      const name = identifierName(node) ?? "";
      const parent = slot.parent;
      const memberName =
        parent?.type === "MemberExpression" && slot.key === "object" && field(parent, "computed") !== true
          ? identifierName(nodeField(parent, "property"))
          : undefined;
      const top = module.top.get(name);
      if (top !== undefined) {
        enter({ file: pending.file, name, node: top }, pending.path);
      } else if (module.imports.has(name)) {
        importSink(pending.file, name, { member: memberName }, pending.path);
      } else if (name === "fetch") {
        record({ kind: "fetch", path: pending.path, what: "global fetch" });
      } else if (services.has(name)) {
        record({ kind: "service", path: pending.path, what: name });
      }
    });
  }

  return [...found.values()].slice(0, MAX_SINKS);
};

/** A short, stable digest of a path step's source text, so a changed declaration reopens an acceptance. */
export const digestOf = (program: Program, step: Step): string => {
  const text = program.repo.read(step.file) ?? "";
  const body = step.end > step.start ? text.slice(step.start, step.end) : "";
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
};
