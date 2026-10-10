/**
 * Worktree hygiene for parallel agents: stable ports per worktree, and finding or stopping the processes a worktree
 * left behind without touching anything outside it.
 *
 * @module
 */
export { exitCodes, runCli, type CliContext } from "./cli.js";
export {
  defaultProtectedNames,
  mentionsWorktree,
  orphanedTrees,
  selectWorktreeProcesses,
  type Evidence,
  type OwnedProcess,
  type ProcessInfo,
  type Selection,
  type SelectionRequest,
  type WorktreeScope,
} from "./ownership.js";
export { fnv1a, worktreeKey, worktreePorts, type PortLayout, type PortRequest, type WorktreePorts } from "./ports.js";
export { readSnapshot, SnapshotError, type Listener, type Snapshot } from "./process-table.js";
export { stopProcesses, type StopOutcome, type StopRequest } from "./stop.js";
export { resolveWorktree, ScopeError, type Worktree } from "./worktree.js";
