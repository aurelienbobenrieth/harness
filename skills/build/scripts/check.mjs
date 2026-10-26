import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

/** Preserve the command's exit status while retaining one diagnostic per file. */
export function compact(output) {
  const seen = new Set();
  return output
    .split(/\r?\n/u)
    .filter((line) => {
      if (!/error|fail|not ok|assert|exception|ERR_/iu.test(line)) return false;
      const key = line.match(/(?:^|\s)([^\s:]+\.[cm]?[jt]sx?)(?::\d+|\(\d+)/u)?.[1] ?? line.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30)
    .join("\n");
}

export function check(args, cwd = process.cwd()) {
  if (!args.length) throw new Error("Usage: node check.mjs <node-script> [arguments]");
  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 8e6,
  });
  const status = r.status ?? 2;
  const output = (r.stdout ?? "") + (r.stderr ?? "");
  return {
    status,
    summary:
      status === 0
        ? "PASS"
        : compact(output) || r.error?.message || output.slice(-2000) || `FAILED (${status})`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = check(process.argv.slice(2));
    console.log(result.summary);
    process.exitCode = result.status;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
