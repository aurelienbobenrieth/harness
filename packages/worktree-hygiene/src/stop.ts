/**
 * Stopping selected processes without hitting a PID that was reused since the selection snapshot.
 *
 * @module
 */
import { setTimeout as delay } from "node:timers/promises";
import type { ProcessInfo } from "./ownership.js";

export type StopOutcome = {
  /** Gone after the signal. */
  readonly stopped: readonly ProcessInfo[];
  /** Gone, or replaced by another process with the same PID, before any signal was sent: left alone. */
  readonly vanished: readonly ProcessInfo[];
  /** Still running with the same identity after the force signal. */
  readonly survivors: readonly ProcessInfo[];
};

export type StopRequest = {
  /** Targets, parents first so a supervisor cannot restart a child already stopped. */
  readonly targets: readonly ProcessInfo[];
  /** Fresh table reader; called before signalling and while waiting. */
  readonly readTable: () => Promise<readonly ProcessInfo[]>;
  /** Signal sender, `process.kill` in production. */
  readonly signal: (pid: number, signal: NodeJS.Signals) => void;
  /** How long a polite `SIGTERM` gets before `SIGKILL`. Defaults to 3000 ms. */
  readonly graceMs?: number;
  /** Poll interval while waiting. Defaults to 250 ms. */
  readonly pollMs?: number;
};

function sameProcess(left: ProcessInfo, right: ProcessInfo): boolean {
  return left.pid === right.pid && left.started === right.started && left.commandLine === right.commandLine;
}

function alive(table: readonly ProcessInfo[], targets: readonly ProcessInfo[]): readonly ProcessInfo[] {
  return targets.filter((target) => table.some((row) => sameProcess(row, target)));
}

function send(signal: StopRequest["signal"], pid: number, name: NodeJS.Signals): void {
  try {
    signal(pid, name);
  } catch (error) {
    // ESRCH: it exited between the check and the signal, the outcome asked for. EPERM: not ours to signal; it stays
    // in the table and is reported as a survivor.
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code !== "ESRCH" && code !== "EPERM") throw error;
  }
}

/** Poll until every target is gone or the deadline passes; resolves to the targets still running. */
async function pollUntil(
  request: StopRequest,
  targets: readonly ProcessInfo[],
  deadline: number,
): Promise<readonly ProcessInfo[]> {
  const remaining = alive(await request.readTable(), targets);
  if (remaining.length === 0 || Date.now() >= deadline) return remaining;
  await delay(request.pollMs ?? 250);
  return pollUntil(request, remaining, deadline);
}

function waitUntilGone(request: StopRequest, targets: readonly ProcessInfo[]): Promise<readonly ProcessInfo[]> {
  return pollUntil(request, targets, Date.now() + (request.graceMs ?? 3000));
}

/**
 * Revalidate every target against a fresh table (same PID, start time, and command line), send `SIGTERM`, then
 * `SIGKILL` to whatever outlives the grace period, revalidating again before each signal.
 */
export async function stopProcesses(request: StopRequest): Promise<StopOutcome> {
  const live = alive(await request.readTable(), request.targets);
  const vanished = request.targets.filter((target) => !live.includes(target));
  for (const target of live) send(request.signal, target.pid, "SIGTERM");

  const stubborn = await waitUntilGone(request, live);
  for (const target of alive(await request.readTable(), stubborn)) send(request.signal, target.pid, "SIGKILL");
  const survivors = stubborn.length === 0 ? [] : await waitUntilGone(request, stubborn);

  return { stopped: live.filter((target) => !survivors.includes(target)), vanished, survivors };
}
