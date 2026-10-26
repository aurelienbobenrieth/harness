#!/usr/bin/env node
/** Install the managed commit-msg hook; an existing foreign hook must explicitly chain the checker. */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const quote = (value) => "'" + value.replaceAll("\\", "/").replaceAll("'", "'\\''") + "'";

try {
  const hook = path.resolve(
    execFileSync("git", ["rev-parse", "--git-path", "hooks/commit-msg"], {
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
  );
  const checker = path.join(import.meta.dirname, "check-commit.mjs");
  const content = `#!/bin/sh\n# harness:commit-msg\nexec ${quote(process.execPath)} ${quote(checker)} "$1"\n`;
  if (existsSync(hook) && readFileSync(hook, "utf8") !== content)
    throw new Error('Existing commit-msg hook preserved; add harness-check-commit "$1" to it explicitly.');
  mkdirSync(path.dirname(hook), { recursive: true });
  writeFileSync(hook, content);
  chmodSync(hook, 0o755);
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
