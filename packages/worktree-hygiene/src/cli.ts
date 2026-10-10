/**
 * The `worktree-hygiene` command line: `ports`, `ps`, `reap`, `done`. Every effect goes through `CliContext`, so tests
 * drive the real argument handling against fake or real process tables.
 *
 * @module
 */
import { parseArgs } from "node:util";
import {
  defaultProtectedNames,
  orphanedTrees,
  type OwnedProcess,
  type ProcessInfo,
  selectWorktreeProcesses,
} from "./ownership.js";
import { worktreePorts } from "./ports.js";
import { type Listener, readSnapshot, type Snapshot, SnapshotError } from "./process-table.js";
import { stopProcesses, type StopOutcome } from "./stop.js";
import { resolveWorktree, ScopeError, type Worktree } from "./worktree.js";

/** 0 done and clean · 1 leftovers, survivors, or a port held outside the worktree · 2 usage · 3 inspection failed. */
export const exitCodes = { ok: 0, violation: 1, usage: 2, unavailable: 3 } as const;

export type CliContext = {
  readonly cwd: string;
  readonly pid: number;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly readSnapshot?: () => Promise<Snapshot>;
  readonly resolveWorktree?: (directory: string) => Promise<Worktree>;
  readonly signal?: (pid: number, signal: NodeJS.Signals) => void;
  readonly graceMs?: number;
};

const usage = `Usage: worktree-hygiene <command> [options]

  ports <name...>   stable ports for this worktree, one per name, in order
      --format json|env   json (default) or NAME_PORT=1234 lines
      --check             exit 1 when a process outside the worktree holds one of them
      --base N --ranges N --stride N   port layout (20000, 900, 10)
  ps                list processes started from this worktree
  reap              stop orphaned worktree processes (parent gone)
      --all               stop every worktree process except the caller's own chain
      --dry-run           print what would stop, stop nothing
  done              end-of-task check: exit 1 while worktree processes still run
      --reap              stop them first, then check

  Common: --root DIR (default: the git worktree of the current directory)
          --protect NAME  never stop descendants of NAME (repeatable; editors and agents by default)
          --json          machine-readable output on stdout
`;

class UsageError extends Error {
  override readonly name = "UsageError";
}

type Options = {
  readonly root: string | undefined;
  readonly json: boolean;
  readonly all: boolean;
  readonly dryRun: boolean;
  readonly reap: boolean;
  readonly check: boolean;
  readonly format: string;
  readonly protect: readonly string[];
  readonly layout: { readonly base?: number; readonly ranges?: number; readonly stride?: number };
};

function integerOption(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/u.test(value)) throw new UsageError(`--${name} takes a positive integer, not "${value}".`);
  return Number(value);
}

function parse(argv: readonly string[]): { command: string | undefined; positionals: string[]; options: Options } {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      root: { type: "string" },
      json: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      reap: { type: "boolean", default: false },
      check: { type: "boolean", default: false },
      format: { type: "string", default: "json" },
      protect: { type: "string", multiple: true, default: [] },
      base: { type: "string" },
      ranges: { type: "string" },
      stride: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...rest] = values.help ? ["help"] : positionals;
  const layout = {
    ...(values.base === undefined ? {} : { base: integerOption(values.base, "base") }),
    ...(values.ranges === undefined ? {} : { ranges: integerOption(values.ranges, "ranges") }),
    ...(values.stride === undefined ? {} : { stride: integerOption(values.stride, "stride") }),
  };
  return {
    command,
    positionals: rest,
    options: {
      root: values.root,
      json: values.json,
      all: values.all,
      dryRun: values["dry-run"],
      reap: values.reap,
      check: values.check,
      format: values.format,
      protect: values.protect,
      layout,
    },
  };
}

function portsOf(listeners: readonly Listener[] | undefined, pid: number): readonly number[] {
  return (listeners ?? []).filter((listener) => listener.pid === pid).map((listener) => listener.port);
}

function describe(entry: OwnedProcess, listeners: readonly Listener[] | undefined): string {
  const { pid, name, commandLine } = entry.process;
  const ports = portsOf(listeners, pid);
  const notes = [
    entry.evidence,
    ...(entry.orphaned ? ["orphaned"] : []),
    ...(ports.length > 0 ? [`listening ${ports.join(",")}`] : []),
    ...(entry.protectedBy === undefined ? [] : [`protected by ${entry.protectedBy}`]),
  ];
  const command = commandLine.length > 160 ? `${commandLine.slice(0, 157)}...` : commandLine;
  return `  ${String(pid).padStart(7)}  ${name}  [${notes.join(", ")}]  ${command}\n`;
}

function processJson(entry: OwnedProcess, listeners: readonly Listener[] | undefined) {
  return {
    pid: entry.process.pid,
    ppid: entry.process.ppid,
    name: entry.process.name,
    evidence: entry.evidence,
    orphaned: entry.orphaned,
    ports: portsOf(listeners, entry.process.pid),
    ...(entry.protectedBy === undefined ? {} : { protectedBy: entry.protectedBy }),
    commandLine: entry.process.commandLine,
  };
}

async function inspect(context: CliContext, worktree: Worktree, options: Options) {
  const read = context.readSnapshot ?? readSnapshot;
  const snapshot = await read();
  const selection = selectWorktreeProcesses({
    table: snapshot.processes,
    root: worktree.root,
    nested: worktree.nested,
    self: context.pid,
    protectedNames: [...defaultProtectedNames, ...options.protect],
  });
  return { read, snapshot, selection };
}

async function stop(context: CliContext, read: () => Promise<Snapshot>, targets: readonly ProcessInfo[]) {
  return stopProcesses({
    targets,
    readTable: async () => (await read()).processes,
    signal: context.signal ?? ((pid, signal) => process.kill(pid, signal)),
    ...(context.graceMs === undefined ? {} : { graceMs: context.graceMs }),
  });
}

function reportStop(context: CliContext, outcome: StopOutcome): void {
  for (const target of outcome.stopped) context.stderr(`stopped ${target.pid} ${target.name}\n`);
  for (const target of outcome.vanished) context.stderr(`left ${target.pid}: exited or replaced before the signal\n`);
  for (const target of outcome.survivors) context.stderr(`still running ${target.pid} ${target.name}\n`);
}

async function portsCommand(context: CliContext, worktree: Worktree, names: readonly string[], options: Options) {
  if (!["json", "env"].includes(options.format))
    throw new UsageError(`--format is json or env, not "${options.format}".`);
  const result = worktreePorts({ root: worktree.root, names, worktrees: worktree.worktrees, ...options.layout });

  if (options.format === "env")
    for (const [name, port] of Object.entries(result.ports))
      context.stdout(`${name.toUpperCase().replaceAll("-", "_")}_PORT=${port}\n`);

  if (!options.check) {
    if (options.format === "json") context.stdout(`${JSON.stringify(result)}\n`);
    return exitCodes.ok;
  }

  const { snapshot, selection } = await inspect(context, worktree, options);
  if (snapshot.listeners === undefined) {
    context.stderr("Cannot map ports to processes on this machine (no Get-NetTCPConnection or lsof).\n");
    return exitCodes.unavailable;
  }
  const mine = new Set([
    context.pid,
    ...[...selection.owned, ...selection.protected].map((entry) => entry.process.pid),
  ]);
  const holders = Object.entries(result.ports).flatMap(
    ([name, port]) =>
      snapshot.listeners
        ?.filter((listener) => listener.port === port)
        .map((listener) => ({ name, port, pid: listener.pid, inWorktree: mine.has(listener.pid) })) ?? [],
  );
  if (options.format === "json") context.stdout(`${JSON.stringify({ ...result, holders })}\n`);
  const foreign = holders.filter((holder) => !holder.inWorktree);
  for (const holder of foreign)
    context.stderr(`port ${holder.port} (${holder.name}) is held by pid ${holder.pid}, outside this worktree\n`);
  return foreign.length === 0 ? exitCodes.ok : exitCodes.violation;
}

async function processCommand(context: CliContext, command: string, worktree: Worktree, options: Options) {
  const { read, snapshot, selection } = await inspect(context, worktree, options);
  const listeners = snapshot.listeners;
  const print = (title: string, entries: readonly OwnedProcess[]) => {
    context.stdout(`${title} (${entries.length})\n`);
    for (const entry of entries) context.stdout(describe(entry, listeners));
  };

  if (command === "ps") {
    if (options.json)
      context.stdout(
        `${JSON.stringify({
          root: worktree.root,
          owned: selection.owned.map((entry) => processJson(entry, listeners)),
          protected: selection.protected.map((entry) => processJson(entry, listeners)),
        })}\n`,
      );
    else {
      print(`Processes of ${worktree.root}`, selection.owned);
      if (selection.protected.length > 0) print("Protected, never stopped", selection.protected);
    }
    return exitCodes.ok;
  }

  const stopAll = command === "done" ? options.reap : options.all;
  const targets = stopAll ? selection.owned : orphanedTrees(snapshot.processes, selection.owned);
  if (command === "reap" && options.dryRun) {
    if (options.json)
      context.stdout(
        `${JSON.stringify({ root: worktree.root, wouldStop: targets.map((entry) => processJson(entry, listeners)) })}\n`,
      );
    else print("Would stop", targets);
    return exitCodes.ok;
  }

  const shouldStop = command === "reap" || options.reap;
  const outcome = shouldStop
    ? await stop(
        context,
        read,
        targets.map((entry) => entry.process),
      )
    : undefined;
  if (outcome !== undefined) reportStop(context, outcome);

  if (command === "reap") {
    if (options.json)
      context.stdout(
        `${JSON.stringify({
          root: worktree.root,
          stopped: outcome?.stopped.map((p) => p.pid) ?? [],
          vanished: outcome?.vanished.map((p) => p.pid) ?? [],
          survivors: outcome?.survivors.map((p) => p.pid) ?? [],
        })}\n`,
      );
    else context.stdout(`Stopped ${outcome?.stopped.length ?? 0} process(es) of ${worktree.root}\n`);
    return (outcome?.survivors.length ?? 0) === 0 ? exitCodes.ok : exitCodes.violation;
  }

  const after = outcome === undefined ? selection : (await inspect(context, worktree, options)).selection;
  if (options.json)
    context.stdout(
      `${JSON.stringify({ root: worktree.root, clean: after.owned.length === 0, leftovers: after.owned.map((entry) => processJson(entry, listeners)) })}\n`,
    );
  else if (after.owned.length === 0) context.stdout(`Clean: no process of ${worktree.root} is left running.\n`);
  else {
    print(`Still running from ${worktree.root}`, after.owned);
    context.stdout("Stop them before handing back, or run `worktree-hygiene done --reap`.\n");
  }
  return after.owned.length === 0 ? exitCodes.ok : exitCodes.violation;
}

/** Run one command; resolves to the process exit code and never throws for expected failures. */
export async function runCli(argv: readonly string[], context: CliContext): Promise<number> {
  try {
    const { command, positionals, options } = parse(argv);
    if (command === undefined || command === "help") {
      (command === undefined ? context.stderr : context.stdout)(usage);
      return command === undefined ? exitCodes.usage : exitCodes.ok;
    }
    if (!["ports", "ps", "reap", "done"].includes(command)) throw new UsageError(`Unknown command "${command}".`);
    if (command !== "ports" && positionals.length > 0)
      throw new UsageError(`${command} takes no arguments, got "${positionals.join(" ")}".`);
    if (command === "ports" && positionals.length === 0) throw new UsageError("ports needs at least one name.");

    const worktree = await (context.resolveWorktree ?? resolveWorktree)(options.root ?? context.cwd);
    return command === "ports"
      ? await portsCommand(context, worktree, positionals, options)
      : await processCommand(context, command, worktree, options);
  } catch (error) {
    if (error instanceof SnapshotError) {
      context.stderr(`${error.message}\n`);
      return exitCodes.unavailable;
    }
    if (
      error instanceof UsageError ||
      error instanceof ScopeError ||
      error instanceof RangeError ||
      isParseError(error)
    ) {
      context.stderr(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`);
      return exitCodes.usage;
    }
    throw error;
  }
}

function isParseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("ERR_PARSE_ARGS_")
  );
}
