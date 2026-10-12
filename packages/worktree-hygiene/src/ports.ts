/**
 * Stable dev-server ports per worktree, so parallel checkouts never serve or test each other's code.
 *
 * @module
 */

/** Where port ranges start, how many ranges exist, and how many ports each range holds. */
export type PortLayout = {
  /** First port of range 0. Defaults to 20000. */
  readonly base?: number;
  /** Number of ranges the hash spreads worktrees over. Defaults to 900. */
  readonly ranges?: number;
  /** Ports per range, and so the most names one worktree can ask for. Defaults to 10. */
  readonly stride?: number;
};

export type PortRequest = PortLayout & {
  /** Absolute path of the worktree the ports belong to. */
  readonly root: string;
  /** One name per server, in a fixed order: `["game", "worker"]` gives the range's first two ports. */
  readonly names: readonly string[];
  /**
   * Every worktree of the same repository, `root` included. When given, worktrees whose hashes land in the same range
   * are moved to the next free one, in path order, so no two worktrees of the repository share a port.
   */
  readonly worktrees?: readonly string[];
  /** Path case rule: `win32` compares paths case-insensitively. Defaults to the current platform. */
  readonly platform?: NodeJS.Platform;
};

export type WorktreePorts = {
  readonly root: string;
  /** Range index the worktree got; equal to its hash range unless a sibling worktree already held it. */
  readonly range: number;
  readonly ports: Readonly<Record<string, number>>;
};

/** Path key two spellings of the same worktree share: forward slashes, no trailing slash, lowercased on Windows. */
export function worktreeKey(root: string, platform: NodeJS.Platform = process.platform): string {
  const slashed = root.replaceAll("\\", "/").replace(/\/+$/u, "");
  return platform === "win32" ? slashed.toLowerCase() : slashed;
}

/** 32-bit FNV-1a over the UTF-16 code units of `text`. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function assertLayout(base: number, ranges: number, stride: number, names: readonly string[]): void {
  if (![base, ranges, stride].every((value) => Number.isInteger(value) && value > 0))
    throw new RangeError("Port base, ranges, and stride must be positive integers.");
  if (base + ranges * stride - 1 > 65_535) throw new RangeError("The port layout ends above 65535.");
  if (names.length === 0) throw new RangeError("Ask for at least one port name.");
  if (names.length > stride) throw new RangeError(`At most ${stride} port names fit in one range.`);
  if (new Set(names).size !== names.length) throw new RangeError("Port names must be unique.");
  for (const name of names)
    if (!/^[a-z][a-z0-9-]*$/u.test(name)) throw new RangeError(`Port name "${name}" must be lowercase kebab-case.`);
}

/** Ranges for every worktree of a repository: hash range first, else the next free one, worktrees in key order. */
function assignRanges(keys: readonly string[], ranges: number): ReadonlyMap<string, number> {
  const taken = new Set<number>();
  const assigned = new Map<string, number>();
  for (const key of [...new Set(keys)].toSorted()) {
    const preferred = fnv1a(key) % ranges;
    const offset = Array.from({ length: ranges }, (_, step) => step).find(
      (step) => !taken.has((preferred + step) % ranges),
    );
    if (offset === undefined) throw new RangeError(`More than ${ranges} worktrees: no free port range is left.`);
    const range = (preferred + offset) % ranges;
    taken.add(range);
    assigned.set(key, range);
  }
  return assigned;
}

/**
 * The ports of one worktree: `base + range × stride + index of the name`. The same path always gets the same ports;
 * pass `worktrees` to also rule out collisions between worktrees of one repository. Ports of unrelated repositories
 * can still collide, so servers should start with a strict port and fail rather than drift.
 */
export function worktreePorts(request: PortRequest): WorktreePorts {
  const { root, names, platform = process.platform, base = 20_000, ranges = 900, stride = 10 } = request;
  assertLayout(base, ranges, stride, names);

  const key = worktreeKey(root, platform);
  const keys = [key, ...(request.worktrees ?? []).map((worktree) => worktreeKey(worktree, platform))];
  const range = request.worktrees === undefined ? fnv1a(key) % ranges : (assignRanges(keys, ranges).get(key) ?? 0);
  const ports = Object.fromEntries(names.map((name, index) => [name, base + range * stride + index]));
  return { root, range, ports };
}
