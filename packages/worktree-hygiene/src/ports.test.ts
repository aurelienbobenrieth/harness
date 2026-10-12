import { describe, expect, it } from "vitest";
import { fnv1a, worktreePorts } from "./ports.ts";

describe("fnv1a", () => {
  it.each([
    ["", 0x811c9dc5],
    ["a", 0xe40c292c],
    ["foobar", 0xbf9cf968],
  ])("hashes %j to the published FNV-1a 32-bit vector", (text, expected) => {
    expect(fnv1a(text)).toBe(expected);
  });
});

describe("worktree ports", () => {
  const names = ["game", "worker", "atelier"];

  it("gives consecutive ports inside the worktree's range, in name order", () => {
    const { range, ports } = worktreePorts({ root: "/work/panache", names, platform: "linux" });

    expect(ports).toStrictEqual({
      game: 20_000 + range * 10,
      worker: 20_000 + range * 10 + 1,
      atelier: 20_000 + range * 10 + 2,
    });
    expect(range).toBe(fnv1a("/work/panache") % 900);
  });

  it("gives the same ports to two spellings of one Windows path", () => {
    const native = worktreePorts({ root: "C:\\Work\\Panache\\", names, platform: "win32" });
    const slashed = worktreePorts({ root: "c:/work/panache", names, platform: "win32" });

    expect(slashed.ports).toStrictEqual(native.ports);
  });

  it("keeps case significant on POSIX", () => {
    expect(worktreePorts({ root: "/Work/a", names, platform: "linux" }).range).not.toBe(
      worktreePorts({ root: "/work/a", names, platform: "linux" }).range,
    );
  });

  it("moves sibling worktrees whose hashes share a range to distinct ranges", () => {
    // With 2 ranges, 3 worktrees cannot all keep their hash range; every pair must still differ.
    const worktrees = ["/w/a", "/w/b", "/w/c"];
    expect(() => worktreePorts({ root: "/w/a", names: ["game"], worktrees, ranges: 2, platform: "linux" })).toThrow(
      RangeError,
    );

    const many = Array.from({ length: 40 }, (_, index) => `/w/tree-${index}`);
    const ranges = many.map(
      (root) => worktreePorts({ root, names: ["game"], worktrees: many, ranges: 50, platform: "linux" }).range,
    );
    expect(new Set(ranges).size).toBe(many.length);
  });

  it("assigns the same range whichever worktree asks", () => {
    const worktrees = Array.from({ length: 30 }, (_, index) => `/w/tree-${index}`);
    const forward = worktreePorts({ root: "/w/tree-7", names, worktrees, ranges: 40, platform: "linux" });
    const reversed = worktreePorts({
      root: "/w/tree-7",
      names,
      worktrees: worktrees.toReversed(),
      ranges: 40,
      platform: "linux",
    });

    expect(reversed.ports).toStrictEqual(forward.ports);
  });

  it.each([
    { label: "no names", request: { names: [] } },
    { label: "more names than the stride", request: { names: ["a", "b", "c"], stride: 2 } },
    { label: "duplicate names", request: { names: ["game", "game"] } },
    { label: "a name that is not kebab-case", request: { names: ["Game Port"] } },
    { label: "a layout ending above 65535", request: { names: ["game"], base: 60_000 } },
    { label: "a zero stride", request: { names: ["game"], stride: 0 } },
  ])("rejects $label", ({ request }) => {
    expect(() => worktreePorts({ root: "/w/a", platform: "linux", ...request })).toThrow(RangeError);
  });
});
