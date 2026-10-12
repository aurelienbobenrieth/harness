import { describe, expect, it } from "vitest";
import { parseLsofFields, parseLstart, parsePs, SnapshotError } from "./process-table.ts";

describe("ps output", () => {
  it("reads pid, parent, start time, and the full command line", () => {
    const output =
      "    1     0 Sun Oct 11 01:09:10 2026 /sbin/init splash\n" +
      "  812     1 Mon Oct  5 23:59:01 2026 /usr/bin/node /work/a/node_modules/vite/bin/vite.js --port 20140\n" +
      "garbage line\n";

    expect(parsePs(output)).toStrictEqual([
      {
        pid: 1,
        ppid: 0,
        name: "init",
        commandLine: "/sbin/init splash",
        started: new Date(2026, 9, 11, 1, 9, 10).getTime(),
      },
      {
        pid: 812,
        ppid: 1,
        name: "node",
        commandLine: "/usr/bin/node /work/a/node_modules/vite/bin/vite.js --port 20140",
        started: new Date(2026, 9, 5, 23, 59, 1).getTime(),
      },
    ]);
  });

  it("refuses a start time it cannot read rather than guessing one", () => {
    expect(() => parseLstart("yesterday")).toThrow(SnapshotError);
  });
});

describe("lsof field output", () => {
  it("pairs every name line with the process line above it", () => {
    expect(parseLsofFields("p12\nn/work/a\np13\nn*:20140\nn127.0.0.1:20141\n")).toStrictEqual([
      [12, "/work/a"],
      [13, "*:20140"],
      [13, "127.0.0.1:20141"],
    ]);
  });
});
