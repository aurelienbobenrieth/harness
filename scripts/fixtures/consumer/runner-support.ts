import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";

export const runnerRoot = path.resolve("runner-fixtures");
await mkdir(path.join(runnerRoot, "blocks"), { recursive: true });
export const writeFixture = (target: string, content: string): Promise<void> =>
  writeFile(path.join(runnerRoot, target), content);

export function run(executable: string, args: readonly string[], expectedExit: number): string {
  const result = spawnSync(process.execPath, [executable, ...args], {
    cwd: runnerRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe("");
  expect({ status: result.status, ...(result.status === expectedExit ? {} : { output: result.stdout }) }).toEqual({
    status: expectedExit,
  });
  return result.stdout;
}
