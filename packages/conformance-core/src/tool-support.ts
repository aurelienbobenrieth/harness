import { execFile } from "node:child_process";
import path from "node:path";
import { fileExists, isRecord, parseJson, readTextFile } from "./fs-support.js";

export type ToolResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly failed: boolean;
  readonly timedOut: boolean;
};

const defaultToolTimeoutMs = 120_000;

/**
 * Resolves an installed tool's executable entry (the JS file behind its `bin`),
 * walking node_modules from `root` upward like Node's resolver. Returns
 * undefined when the tool is not installed anywhere above `root`.
 */
export async function resolveToolBin(root: string, toolName: string): Promise<string | undefined> {
  let directory = path.resolve(root);
  for (;;) {
    const packageJsonPath = path.join(directory, "node_modules", toolName, "package.json");
    if (await fileExists(packageJsonPath)) {
      const manifest = parseJson(await readTextFile(packageJsonPath));
      if (!isRecord(manifest)) return undefined;
      const bin = manifest["bin"];
      const binRelative =
        typeof bin === "string"
          ? bin
          : isRecord(bin)
            ? typeof bin[toolName] === "string"
              ? bin[toolName]
              : Object.values(bin).find((value): value is string => typeof value === "string")
            : undefined;
      if (binRelative === undefined) return undefined;
      return path.join(path.dirname(packageJsonPath), binRelative);
    }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/**
 * Runs a command with a hard timeout. Never throws: failures and timeouts are
 * reported through the result so checks can turn them into findings.
 */
export function runTool(
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly timeoutMs?: number },
): Promise<ToolResult> {
  // Windows package-manager shims are .cmd scripts, which Node refuses to spawn without a shell.
  const shimCommands = new Set(["npx", "npm", "pnpm", "yarn"]);
  const needsShell = process.platform === "win32" && (/\.(cmd|bat)$/i.test(command) || shimCommands.has(command));
  if (needsShell)
    return Promise.resolve({
      stdout: "",
      stderr: "Use a native executable or node plus the installed tool's JS entrypoint; shell shims are not supported.",
      failed: true,
      timedOut: false,
    });
  const finalArgs = [...args];
  return new Promise((resolve) => {
    execFile(
      command,
      finalArgs,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? defaultToolTimeoutMs,
        killSignal: "SIGKILL",
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        shell: false,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          failed: error !== null,
          timedOut: error !== null && (error.killed === true || error.signal === "SIGKILL"),
        });
      },
    );
  });
}

export function excerpt(text: string, maxLength = 400): string {
  const trimmed = text.trim();
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength)}…`;
}
