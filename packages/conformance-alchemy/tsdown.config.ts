import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/vitest.ts"],
  format: ["esm"],
  // Inline conformance-core's report types so the published declarations carry no dependency on it.
  dts: { resolve: ["@aurelienbbn/conformance-core"] },
  sourcemap: true,
  clean: true,
});
