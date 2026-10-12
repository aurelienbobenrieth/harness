import { describe, expect, it } from "vitest";
import type { ProcessInfo } from "./ownership.ts";
import { stopProcesses } from "./stop.ts";

const proc = (pid: number, started = pid): ProcessInfo => ({
  pid,
  ppid: 1,
  name: "node",
  commandLine: `node ${pid}`,
  started,
});

/** A process table that obeys signals: `SIGTERM` stops the compliant PIDs, `SIGKILL` stops everyone but `immortal`. */
function machine(
  rows: readonly ProcessInfo[],
  options: { stubborn?: readonly number[]; immortal?: readonly number[] } = {},
) {
  const running = new Map(rows.map((row) => [row.pid, row]));
  const signals: string[] = [];
  return {
    signals,
    readTable: async () => [...running.values()],
    signal: (pid: number, signal: NodeJS.Signals) => {
      signals.push(`${signal} ${pid}`);
      if (!running.has(pid)) throw Object.assign(new Error("no such process"), { code: "ESRCH" });
      if (options.immortal?.includes(pid)) return;
      if (signal === "SIGKILL" || !options.stubborn?.includes(pid)) running.delete(pid);
    },
  };
}

describe("stopping processes", () => {
  it("sends SIGTERM in target order and reports every target stopped", async () => {
    const fake = machine([proc(10), proc(11)]);
    const outcome = await stopProcesses({ targets: [proc(10), proc(11)], ...fake, graceMs: 0, pollMs: 1 });

    expect(fake.signals).toStrictEqual(["SIGTERM 10", "SIGTERM 11"]);
    expect(outcome).toStrictEqual({ stopped: [proc(10), proc(11)], vanished: [], survivors: [] });
  });

  it("leaves a PID alone when it now names a different process", async () => {
    const fake = machine([proc(10, 999)]);
    const outcome = await stopProcesses({ targets: [proc(10)], ...fake, graceMs: 0, pollMs: 1 });

    expect(fake.signals).toStrictEqual([]);
    expect(outcome.vanished).toStrictEqual([proc(10)]);
  });

  it("forces what outlives the grace period", async () => {
    const fake = machine([proc(10)], { stubborn: [10] });
    const outcome = await stopProcesses({ targets: [proc(10)], ...fake, graceMs: 5, pollMs: 1 });

    expect(fake.signals).toStrictEqual(["SIGTERM 10", "SIGKILL 10"]);
    expect(outcome.stopped).toStrictEqual([proc(10)]);
  });

  it("reports a process that survives the force signal", async () => {
    const fake = machine([proc(10)], { immortal: [10] });
    const outcome = await stopProcesses({ targets: [proc(10)], ...fake, graceMs: 5, pollMs: 1 });

    expect(outcome).toStrictEqual({ stopped: [], vanished: [], survivors: [proc(10)] });
  });

  it("reports a process it may not signal as a survivor instead of failing", async () => {
    const fake = machine([proc(10)]);
    const outcome = await stopProcesses({
      targets: [proc(10)],
      readTable: fake.readTable,
      signal: () => {
        throw Object.assign(new Error("operation not permitted"), { code: "EPERM" });
      },
      graceMs: 0,
      pollMs: 1,
    });

    expect(outcome.survivors).toStrictEqual([proc(10)]);
  });

  it("treats a process that exits between the check and the signal as stopped", async () => {
    const fake = machine([proc(10)]);
    const outcome = await stopProcesses({
      targets: [proc(10)],
      readTable: fake.readTable,
      signal: (pid, signal) => {
        fake.signal(pid, signal);
        fake.signal(pid, signal);
      },
      graceMs: 0,
      pollMs: 1,
    });

    expect(outcome.stopped).toStrictEqual([proc(10)]);
  });
});
