import path from "node:path";
import { defaultStackFile, joinProject } from "./project-files.js";
import type { PackageManifest } from "./workspace.js";

/** One `alchemy <command>` found in a shell script, directly or through a package runner or script. */
export type AlchemyInvocation = {
  /** `deploy`, `destroy`, `plan`, ... */
  readonly command: string;
  /** Raw `--stage` value, unexpanded. */
  readonly stage?: string;
  /** Raw `--config` / `-c` / positional entrypoint, unexpanded. */
  readonly config?: string;
  /** Project-relative working directory; `undefined` when it cannot be resolved statically. */
  readonly cwd: string | undefined;
  /** `NAME=value` assignments written before the command. */
  readonly env: Readonly<Record<string, string>>;
  /** The command as written, for messages. */
  readonly text: string;
  /** `package.json` script the command came from, when resolved through one. */
  readonly script?: string;
};

/** A command that may run Alchemy through a package script this reading cannot resolve. */
export type UnresolvedCommand = {
  /** The command as written. */
  readonly text: string;
  /** Why it was not followed, phrased to complete "`<text>` ...". */
  readonly reason: string;
};

export type CommandScan = {
  readonly invocations: readonly AlchemyInvocation[];
  readonly unresolved: readonly UnresolvedCommand[];
};

/** Workspace manifests (for `--filter`, `-w`, `workspace <name>`, `-r`) and on-disk lookup by directory. */
export type ScriptContext = {
  readonly members: readonly PackageManifest[];
  readonly manifestAt: (directory: string) => Promise<PackageManifest | "unreadable" | undefined>;
};

const separators = new Set(["&&", "||", ";", "|", "&", "\n"]);
const valueFlags = new Set(["--stage", "--config", "-c", "--profile", "--env-file"]);
/** Scripts nest at most this deep: a workflow step, a script, and the script it runs. */
const maxScriptDepth = 2;
/** Runner subcommands that never run a package script. `bun test` is bun's own test runner. */
const builtins: Readonly<Record<string, ReadonlySet<string>>> = {
  pnpm: new Set(
    ["add", "audit", "config", "deploy", "fetch", "i", "import", "init", "install", "link", "list", "ls"].concat([
      "outdated",
      "pack",
      "patch",
      "prune",
      "publish",
      "rebuild",
      "remove",
      "rm",
      "store",
      "unlink",
      "up",
      "update",
      "why",
    ]),
  ),
  yarn: new Set([
    "add",
    "config",
    "info",
    "init",
    "install",
    "link",
    "npm",
    "pack",
    "plugin",
    "remove",
    "set",
    "up",
    "why",
  ]),
  bun: new Set(
    ["a", "add", "build", "create", "i", "init", "install", "link", "outdated", "pm", "publish", "remove", "rm"].concat(
      ["test", "unlink", "update", "upgrade"],
    ),
  ),
};

/**
 * Splits a shell script into simple commands of unquoted words. Understands quotes, backslash line
 * continuations, and `${{ ... }}` GitHub expressions as single words; no expansion happens here.
 */
function splitCommands(script: string): string[][] {
  const commands: string[][] = [];
  let words: string[] = [];
  let word = "";
  let open = false;
  const endWord = (): void => {
    if (open) words.push(word);
    word = "";
    open = false;
  };
  const endCommand = (): void => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };
  const text = script.replaceAll(/\\\r?\n/gu, " ");
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    const pair = text.slice(index, index + 2);
    if (pair === "${" && text.charAt(index + 2) === "{") {
      const close = text.indexOf("}}", index);
      const end = close === -1 ? text.length : close + 2;
      word += text.slice(index, end);
      open = true;
      index = end - 1;
    } else if (char === "'" || char === '"') {
      const close = text.indexOf(char, index + 1);
      const end = close === -1 ? text.length : close;
      word += text.slice(index + 1, end);
      open = true;
      index = end;
    } else if (char === "#" && !open) {
      const newline = text.indexOf("\n", index);
      index = (newline === -1 ? text.length : newline) - 1;
    } else if (separators.has(pair)) {
      endCommand();
      index += 1;
    } else if (separators.has(char) || char === "\r") {
      endCommand();
    } else if (char === " " || char === "\t") {
      endWord();
    } else {
      word += char;
      open = true;
    }
  }
  endCommand();
  return commands;
}

function isAlchemyBinary(word: string | undefined): boolean {
  if (word === undefined) return false;
  const name = word.split("/").at(-1) ?? word;
  return name === "alchemy" || name.startsWith("alchemy@");
}

function parseAlchemyArguments(
  words: readonly string[],
): { readonly command: string; readonly stage?: string; readonly config?: string } | undefined {
  let command: string | undefined;
  let stage: string | undefined;
  let config: string | undefined;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? "";
    const [flag, inline] = word.startsWith("--") && word.includes("=") ? word.split(/=(.*)/su) : [word, undefined];
    if (flag !== undefined && valueFlags.has(flag)) {
      const value = inline ?? words[index + 1];
      if (inline === undefined) index += 1;
      if (flag === "--stage") stage = value;
      if (flag === "--config" || flag === "-c") config = value;
    } else if (!word.startsWith("-")) {
      if (command === undefined) command = word;
      else config ??= word;
    }
  }
  if (command === undefined) return undefined;
  if (command === "deploy" && words.includes("--dry-run")) command = "plan";
  return { command, ...(stage === undefined ? {} : { stage }), ...(config === undefined ? {} : { config }) };
}

function moveTo(cwd: string | undefined, target: string | undefined): string | undefined {
  if (cwd === undefined || target === undefined || /[$*~`]/u.test(target) || target.startsWith("/")) return undefined;
  return joinProject(cwd, target);
}

/** Which packages a runner targets: the nearest manifest above a directory, or explicit workspace members. */
type Packages =
  | { readonly kind: "nearest"; readonly cwd: string | undefined }
  | { readonly kind: "members"; readonly directories: readonly string[] };

type Target =
  | { readonly kind: "alchemy"; readonly rest: readonly string[]; readonly packages: Packages }
  | { readonly kind: "script"; readonly name: string; readonly args: readonly string[]; readonly packages: Packages }
  | { readonly kind: "unresolved"; readonly reason: string };

type Option = readonly [flag: string, value: string | undefined];

/** Reads options from `index` up to the first positional or `--`; flags in `valued` consume a value. */
function readOptions(
  words: readonly string[],
  index: number,
  valued: ReadonlySet<string>,
): { readonly index: number; readonly options: Option[] } {
  const options: Option[] = [];
  let at = index;
  for (; at < words.length; at += 1) {
    const word = words[at] ?? "";
    if (word === "--" || !word.startsWith("-")) break;
    const equals = word.indexOf("=");
    const flag = equals === -1 ? word : word.slice(0, equals);
    if (!valued.has(flag)) options.push([flag, undefined]);
    else if (equals !== -1) options.push([flag, word.slice(equals + 1)]);
    else {
      at += 1;
      options.push([flag, words[at]]);
    }
  }
  return { index: at, options };
}

function valuesOf(options: readonly Option[], flags: readonly string[]): string[] {
  return options.filter(([flag]) => flags.includes(flag)).map(([, value]) => value ?? "");
}

function globMatcher(glob: string): RegExp {
  const body = glob
    .split(/(\*\*|\*)/u)
    .map((part) => (part === "**" ? ".*" : part === "*" ? "[^/]*" : part.replaceAll(/[.+?^${}()|[\]\\]/gu, "\\$&")))
    .join("");
  return new RegExp(`^${body}$`, "u");
}

/** Member directories a `--filter`, `-w` or `workspace` selector picks: by path when it looks like one, else by name. */
function selectMembers(selector: string, cwd: string | undefined, context: ScriptContext): readonly string[] | string {
  if (selector === "" || /^!|\.\.\.|[{}[\]^]/u.test(selector))
    return `selects packages with "${selector}", a selector this check does not evaluate`;
  const byPath = selector.startsWith(".") || (selector.includes("/") && !selector.startsWith("@"));
  if (byPath && cwd === undefined) return "selects packages relative to a working directory set at run time";
  const matcher = globMatcher(byPath ? joinProject(cwd ?? "", selector) : selector);
  return context.members
    .filter((member) => (byPath ? matcher.test(member.directory) : matcher.test(member.name ?? "")))
    .map((member) => member.directory);
}

function packagesFor(
  cwd: string | undefined,
  selectors: readonly string[],
  everyMember: boolean,
  context: ScriptContext,
): Packages | string {
  if (selectors.length === 0 && !everyMember) return { kind: "nearest", cwd };
  if (selectors.length === 0)
    return {
      kind: "members",
      directories: context.members.map((member) => member.directory).filter((dir) => dir !== ""),
    };
  const directories = new Set<string>();
  for (const selector of selectors) {
    const selected = selectMembers(selector, cwd, context);
    if (typeof selected === "string") return selected;
    for (const directory of selected) directories.add(directory);
  }
  return { kind: "members", directories: [...directories] };
}

function binaryTarget(words: readonly string[], packages: Packages | string): Target | undefined {
  const binary = words.findIndex((word) => !word.startsWith("-"));
  if (!isAlchemyBinary(words[binary])) return undefined;
  if (typeof packages === "string") return { kind: "unresolved", reason: packages };
  return { kind: "alchemy", rest: words.slice(binary + 1), packages };
}

function scriptTarget(name: string, args: readonly string[], packages: Packages | string): Target {
  if (typeof packages === "string") return { kind: "unresolved", reason: packages };
  if (isAlchemyBinary(name)) return { kind: "alchemy", rest: args, packages };
  return { kind: "script", name, args: args[0] === "--" ? args.slice(1) : args, packages };
}

/** Reads `run`/`run-script` and the options around it, shared by pnpm and bun. */
function runForm(
  args: readonly string[],
  valued: ReadonlySet<string>,
  runWords: readonly string[],
): { readonly index: number; readonly options: readonly Option[]; readonly explicit: boolean } {
  const before = readOptions(args, 0, valued);
  if (!runWords.includes(args[before.index] ?? "")) return { ...before, explicit: false };
  const after = readOptions(args, before.index + 1, valued);
  return { index: after.index, options: [...before.options, ...after.options], explicit: true };
}

function directoryOption(options: readonly Option[], start: string | undefined, flags: readonly string[]) {
  const directory = valuesOf(options, flags).at(-1);
  return directory === undefined ? start : moveTo(start, directory);
}

const pnpmValued = new Set(["-C", "--dir", "-F", "--filter", "--reporter", "--loglevel"]);

function pnpmTarget(args: readonly string[], start: string | undefined, context: ScriptContext): Target | undefined {
  const { index, options, explicit } = runForm(args, pnpmValued, ["run", "run-script"]);
  const subcommand = args[index];
  if (subcommand === undefined || (!explicit && builtins["pnpm"]?.has(subcommand))) return undefined;
  const root = options.some(([flag]) => flag === "-w" || flag === "--workspace-root");
  const cwd = root ? "" : directoryOption(options, start, ["-C", "--dir"]);
  const everyMember = options.some(([flag]) => flag === "-r" || flag === "--recursive");
  const packages = packagesFor(cwd, valuesOf(options, ["-F", "--filter"]), everyMember, context);
  if (!explicit && (subcommand === "exec" || subcommand === "dlx"))
    return binaryTarget(args.slice(index + 1), packages);
  return scriptTarget(subcommand, args.slice(index + 1), packages);
}

const npmValued = new Set(["--prefix", "-w", "--workspace"]);
const npmRun = new Set(["run", "run-script", "rum", "urn"]);
const npmLifecycle = new Set(["test", "t", "start", "stop", "restart"]);

/** npm takes its own options anywhere before `--`; only what follows `--` reaches the script. */
function npmTarget(args: readonly string[], start: string | undefined, context: ScriptContext): Target | undefined {
  const positionals: string[] = [];
  const options: Option[] = [];
  let forwarded: readonly string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const read = readOptions(args, index, npmValued);
    options.push(...read.options);
    index = read.index;
    if (args[index] === "--") {
      forwarded = args.slice(index + 1);
      break;
    }
    if (index < args.length) positionals.push(args[index] ?? "");
  }
  const [subcommand = "", ...rest] = positionals;
  const cwd = directoryOption(options, start, ["--prefix"]);
  const everyMember = options.some(([flag]) => flag === "-ws" || flag === "--workspaces");
  const packages = packagesFor(cwd, valuesOf(options, ["-w", "--workspace"]), everyMember, context);
  if (subcommand === "exec" || subcommand === "x") return binaryTarget([...rest, ...forwarded], packages);
  if (npmLifecycle.has(subcommand)) return scriptTarget(subcommand, forwarded, packages);
  const [name, ...extra] = rest;
  if (!npmRun.has(subcommand) || name === undefined) return undefined;
  return scriptTarget(name, [...extra, ...forwarded], packages);
}

function yarnTarget(args: readonly string[], start: string | undefined, context: ScriptContext): Target | undefined {
  const { index, options } = readOptions(args, 0, new Set(["--cwd"]));
  const subcommand = args[index];
  if (subcommand === undefined || builtins["yarn"]?.has(subcommand)) return undefined;
  if (subcommand === "workspaces")
    return {
      kind: "unresolved",
      reason: "runs across workspaces with `yarn workspaces`, which this check does not expand",
    };
  if (subcommand === "workspace") {
    const name = args[index + 1] ?? "";
    const member = context.members.find((manifest) => manifest.name === name);
    if (member === undefined)
      return { kind: "unresolved", reason: `names workspace "${name}", which is not a workspace package` };
    return yarnTarget(args.slice(index + 2), member.directory, context);
  }
  const packages = packagesFor(directoryOption(options, start, ["--cwd"]), [], false, context);
  if (subcommand === "dlx" || subcommand === "exec") return binaryTarget(args.slice(index + 1), packages);
  if (subcommand !== "run") return scriptTarget(subcommand, args.slice(index + 1), packages);
  const name = args[index + 1];
  return name === undefined ? undefined : scriptTarget(name, args.slice(index + 2), packages);
}

const bunValued = new Set(["--cwd", "--filter", "-F"]);

function bunTarget(args: readonly string[], start: string | undefined, context: ScriptContext): Target | undefined {
  const { index, options, explicit } = runForm(args, bunValued, ["run"]);
  const subcommand = args[index];
  if (subcommand === undefined || (!explicit && builtins["bun"]?.has(subcommand))) return undefined;
  const cwd = directoryOption(options, start, ["--cwd"]);
  const packages = packagesFor(cwd, valuesOf(options, ["--filter", "-F"]), false, context);
  if (!explicit && subcommand === "x") return binaryTarget(args.slice(index + 1), packages);
  return scriptTarget(subcommand, args.slice(index + 1), packages);
}

/** Unwraps a direct `alchemy`, `npx`/`bunx`/`pnpx`, or a pnpm, npm, yarn or bun command down to Alchemy or a script. */
function resolveTarget(
  words: readonly string[],
  start: string | undefined,
  context: ScriptContext,
): Target | undefined {
  const [runner, ...args] = words;
  const here: Packages = { kind: "nearest", cwd: start };
  if (isAlchemyBinary(runner)) return { kind: "alchemy", rest: args, packages: here };
  if (runner === "npx" || runner === "bunx" || runner === "pnpx") return binaryTarget(args, here);
  if (runner === "pnpm") return pnpmTarget(args, start, context);
  if (runner === "npm") return npmTarget(args, start, context);
  if (runner === "yarn") return yarnTarget(args, start, context);
  if (runner === "bun") return bunTarget(args, start, context);
  return undefined;
}

async function nearestManifest(
  cwd: string,
  context: ScriptContext,
): Promise<PackageManifest | "unreadable" | undefined> {
  for (let directory = cwd; ; directory = joinProject(path.posix.dirname(directory))) {
    const manifest = await context.manifestAt(directory);
    if (manifest !== undefined || directory === "") return manifest;
  }
}

/** Appends forwarded arguments the way package managers do: to the end of the script text. */
function withArguments(body: string, args: readonly string[]): string {
  const words = args.map((word) =>
    word.includes("${{") || /^[\w@%+=:,./-]*$/u.test(word) ? word : `"${word.replaceAll('"', "")}"`,
  );
  return [body, ...words].join(" ");
}

type ScriptRun = { readonly scan?: CommandScan; readonly reason?: string };

async function scriptManifests(
  target: Extract<Target, { kind: "script" }>,
  context: ScriptContext,
): Promise<readonly PackageManifest[] | string> {
  if (target.packages.kind === "members") {
    const directories = new Set(target.packages.directories);
    return context.members.filter((member) => directories.has(member.directory));
  }
  if (target.packages.cwd === undefined)
    return `runs package script "${target.name}" from a working directory set at run time`;
  const manifest = await nearestManifest(target.packages.cwd, context);
  if (manifest === "unreadable") return `runs package script "${target.name}" from an unreadable package.json`;
  // No package.json up to the root: the runner fails before any script runs, so nothing can deploy.
  return manifest === undefined ? [] : [manifest];
}

async function runScript(
  target: Extract<Target, { kind: "script" }>,
  context: ScriptContext,
  depth: number,
): Promise<ScriptRun> {
  const manifests = await scriptManifests(target, context);
  if (typeof manifests === "string") return { reason: manifests };
  const invocations: AlchemyInvocation[] = [];
  const unresolved: UnresolvedCommand[] = [];
  for (const manifest of manifests) {
    const body = manifest.scripts[target.name];
    if (body === undefined) continue;
    if (depth >= maxScriptDepth)
      return { reason: `runs package script "${target.name}" nested more than ${maxScriptDepth} scripts deep` };
    const script = withArguments(body, target.args);
    const scan = await findAlchemyInvocations(script, manifest.directory, context, depth + 1, target.name);
    invocations.push(...scan.invocations);
    unresolved.push(...scan.unresolved);
  }
  return { scan: { invocations, unresolved } };
}

/**
 * Finds every `alchemy <command>` a script runs. `cd <dir>` moves the working directory for later commands;
 * package scripts are followed up to two levels, with forwarded arguments appended. A script whose package,
 * manifest or runner form cannot be resolved is returned as unresolved, never dropped.
 */
export async function findAlchemyInvocations(
  script: string,
  cwd: string | undefined,
  context: ScriptContext,
  depth = 0,
  fromScript?: string,
): Promise<CommandScan> {
  const invocations: AlchemyInvocation[] = [];
  const unresolved: UnresolvedCommand[] = [];
  let current = cwd;
  for (const words of splitCommands(script)) {
    const env: Record<string, string> = {};
    let first = 0;
    for (; first < words.length; first += 1) {
      const match = /^([A-Za-z_]\w*)=(.*)$/su.exec(words[first] ?? "");
      if (match === null) break;
      env[match[1] ?? ""] = match[2] ?? "";
    }
    const command = words.slice(first);
    if (command[0] === "cd") {
      current = moveTo(current, command[1]);
      continue;
    }
    const target = resolveTarget(command, current, context);
    const text = words.join(" ");
    if (target?.kind === "unresolved") unresolved.push({ text, reason: target.reason });
    else if (target?.kind === "script") {
      const { scan, reason } = await runScript(target, context, depth);
      if (reason !== undefined) unresolved.push({ text, reason });
      for (const found of scan?.invocations ?? []) invocations.push({ ...found, env: { ...env, ...found.env } });
      for (const inner of scan?.unresolved ?? [])
        unresolved.push({ text, reason: `runs script "${target.name}", whose \`${inner.text}\` ${inner.reason}` });
    } else if (target?.kind === "alchemy") {
      const parsed = parseAlchemyArguments(target.rest);
      if (parsed === undefined) continue;
      const directories = target.packages.kind === "nearest" ? [target.packages.cwd] : target.packages.directories;
      const origin = fromScript === undefined ? {} : { script: fromScript };
      for (const directory of directories) invocations.push({ ...parsed, cwd: directory, env, text, ...origin });
    }
  }
  return { invocations, unresolved };
}

/** Project-relative stack file an invocation runs, or undefined when its directory or config is dynamic. */
export function invokedStackFile(invocation: AlchemyInvocation): string | undefined {
  const config = invocation.config ?? defaultStackFile;
  if (invocation.cwd === undefined || /[$*`]/u.test(config) || config.startsWith("/")) return undefined;
  return joinProject(invocation.cwd, config);
}
