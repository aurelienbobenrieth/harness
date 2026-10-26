/** Format first, then apply blank-line autofixes using only the spacing rule. */
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2).filter((argument) => argument !== "--");
const formatted = spawnSync(process.execPath, [process.env.npm_execpath, "exec", "vp", "fmt", ...args], {
  stdio: "inherit",
  windowsHide: true,
});
if (formatted.status === 0) {
  const padded = spawnSync(process.execPath, ["packages/oxlint-plugin-core/bin/format-padding.mjs", ...args], {
    stdio: "inherit",
    windowsHide: true,
  });
  process.exitCode = padded.status ?? 1;
} else process.exitCode = formatted.status ?? 1;
