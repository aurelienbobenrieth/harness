/**
 * Process table and listening-socket snapshots from the operating system: PowerShell CIM on Windows, `ps` plus
 * `/proc` or `lsof` elsewhere. Every child process is bounded by a timeout.
 *
 * @module
 */
import { execFile } from "node:child_process";
import { readlink } from "node:fs/promises";
import { promisify } from "node:util";
import type { ProcessInfo } from "./ownership.js";

const execFileAsync = promisify(execFile);

/** A TCP port some process listens on. */
export type Listener = {
  readonly port: number;
  readonly pid: number;
};

export type Snapshot = {
  readonly processes: readonly ProcessInfo[];
  /** `undefined` when the platform tool that maps ports to processes is missing. */
  readonly listeners: readonly Listener[] | undefined;
};

/** The process table could not be read: inspection is unavailable, which is never a clean result. */
export class SnapshotError extends Error {
  override readonly name = "SnapshotError";
}

const timeout = 30_000;
const maxBuffer = 64 * 1024 * 1024;

async function run(file: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync(file, args, {
    timeout,
    maxBuffer,
    windowsHide: true,
    env: { ...process.env, LC_ALL: "C" },
  });
  return stdout;
}

const windowsScript = `
$ErrorActionPreference = 'Stop'
$processes = @(Get-CimInstance Win32_Process | ForEach-Object {
  $started = 0
  if ($_.CreationDate) { $started = ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() }
  [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; name = [string]$_.Name; executable = [string]$_.ExecutablePath; commandLine = [string]$_.CommandLine; started = [long]$started }
})
$listeners = $null
try {
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | ForEach-Object { [pscustomobject]@{ port = [int]$_.LocalPort; pid = [int]$_.OwningProcess } })
} catch { $listeners = $null }
[pscustomobject]@{ processes = $processes; listeners = $listeners } | ConvertTo-Json -Depth 3 -Compress
`;

type RawWindowsProcess = {
  readonly pid: number;
  readonly ppid: number;
  readonly name: string;
  readonly executable: string;
  readonly commandLine: string;
  readonly started: number;
};

async function windowsSnapshot(): Promise<Snapshot> {
  const encoded = Buffer.from(windowsScript, "utf16le").toString("base64");
  const output = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded]);
  const parsed = JSON.parse(output) as {
    processes: readonly RawWindowsProcess[];
    listeners: readonly Listener[] | null;
  };
  return {
    processes: parsed.processes.map((raw) => ({
      pid: raw.pid,
      ppid: raw.ppid,
      name: raw.name,
      commandLine: raw.commandLine,
      executable: raw.executable === "" ? undefined : raw.executable,
      started: raw.started,
    })),
    listeners: parsed.listeners ?? undefined,
  };
}

const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Epoch milliseconds of a `ps -o lstart` value (`Sun Oct 11 01:09:10 2026`, local time, LC_ALL=C). */
export function parseLstart(value: string): number {
  const match = /^\w{3}\s+(?<month>\w{3})\s+(?<day>\d+)\s+(?<h>\d+):(?<m>\d+):(?<s>\d+)\s+(?<year>\d{4})$/u.exec(
    value.trim(),
  );
  const groups = match?.groups;
  if (groups === undefined) throw new SnapshotError(`Unreadable ps start time "${value}".`);
  const month = months.indexOf((groups["month"] ?? "").toLowerCase());
  return new Date(
    Number(groups["year"]),
    month,
    Number(groups["day"]),
    Number(groups["h"]),
    Number(groups["m"]),
    Number(groups["s"]),
  ).getTime();
}

/** Rows of `ps -A -ww -o pid= -o ppid= -o lstart= -o args=`. */
export function parsePs(output: string): readonly ProcessInfo[] {
  return output.split(/\r?\n/u).flatMap((line) => {
    const match =
      /^\s*(?<pid>\d+)\s+(?<ppid>\d+)\s+(?<lstart>\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s?(?<args>.*)$/u.exec(line);
    const groups = match?.groups;
    if (groups === undefined) return [];
    const commandLine = groups["args"] ?? "";
    return [
      {
        pid: Number(groups["pid"]),
        ppid: Number(groups["ppid"]),
        name: commandLine.split(" ")[0]?.split("/").at(-1) ?? "",
        commandLine,
        started: parseLstart(groups["lstart"] ?? ""),
      },
    ];
  });
}

/** `pid → name` pairs from `lsof -F pn` output (`p123` then `n...` lines). */
export function parseLsofFields(output: string): readonly (readonly [pid: number, name: string])[] {
  const pairs: (readonly [number, string])[] = [];
  let pid: number | undefined;
  for (const line of output.split(/\r?\n/u)) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n") && pid !== undefined) pairs.push([pid, line.slice(1)]);
  }
  return pairs;
}

async function optional(file: string, args: readonly string[]): Promise<string | undefined> {
  try {
    return await run(file, args);
  } catch (error) {
    // lsof exits 1 when one of many processes could not be inspected, yet prints every other one.
    if (typeof error === "object" && error !== null && "stdout" in error && typeof error.stdout === "string")
      return error.stdout === "" ? undefined : error.stdout;
    return undefined;
  }
}

async function linkOrUndefined(file: string): Promise<string | undefined> {
  try {
    return await readlink(file);
  } catch {
    // REASON: another user's process, or one that exited since ps ran; the row keeps its command line as evidence.
    return undefined;
  }
}

async function posixSnapshot(): Promise<Snapshot> {
  const rows = parsePs(await run("ps", ["-A", "-ww", "-o", "pid=", "-o", "ppid=", "-o", "lstart=", "-o", "args="]));
  const cwdOutput =
    process.platform === "linux" ? undefined : await optional("lsof", ["-a", "-d", "cwd", "-n", "-P", "-F", "pn"]);
  const cwds = new Map(parseLsofFields(cwdOutput ?? ""));
  const processes = await Promise.all(
    rows.map(async (row) =>
      process.platform === "linux"
        ? {
            ...row,
            cwd: await linkOrUndefined(`/proc/${row.pid}/cwd`),
            executable: await linkOrUndefined(`/proc/${row.pid}/exe`),
          }
        : { ...row, cwd: cwds.get(row.pid) },
    ),
  );
  const listening = await optional("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pn"]);
  const listeners =
    listening === undefined
      ? undefined
      : parseLsofFields(listening).flatMap(([pid, address]) => {
          const port = Number(address.split(":").at(-1));
          return Number.isInteger(port) ? [{ pid, port }] : [];
        });
  return { processes, listeners };
}

/** A snapshot of every visible process and, when the platform tool exists, every listening TCP port. */
export async function readSnapshot(): Promise<Snapshot> {
  try {
    const snapshot = process.platform === "win32" ? await windowsSnapshot() : await posixSnapshot();
    if (snapshot.processes.length === 0) throw new SnapshotError("The process table came back empty.");
    return snapshot;
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    throw new SnapshotError(
      `Could not read the process table: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }
}
