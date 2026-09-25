import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Inline the private kit so the published plugin never depends on it at runtime.
  deps: { alwaysBundle: ["@aurelienbbn/oxlint-kit"] },
});
