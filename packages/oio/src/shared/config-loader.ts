import path from "node:path";
import { Context, Effect, Layer } from "effect";
import { createJiti } from "jiti";
import type { OioConfig } from "../config.js";
import { fileExists } from "./fs-support.js";

const configFileNames = ["oio.config.ts", "oio.config.js", "oio.config.mjs"];

async function loadConfigFrom(cwd: string): Promise<OioConfig> {
  const candidates = await Promise.all(
    configFileNames.map(async (fileName) => {
      const configPath = path.join(cwd, fileName);
      return (await fileExists(configPath)) ? { fileName, configPath } : undefined;
    }),
  );
  const found = candidates.find((candidate) => candidate !== undefined);
  if (found === undefined) return {};

  const jiti = createJiti(import.meta.url);
  const loaded = await jiti.import(found.configPath, { default: true });
  if (typeof loaded !== "object" || loaded === null) {
    throw new Error(`${found.fileName} must export a config object`);
  }
  return loaded as OioConfig;
}

export class ConfigLoader extends Context.Service<
  ConfigLoader,
  {
    load(cwd: string): Effect.Effect<OioConfig, Error>;
  }
>()("oio/ConfigLoader") {
  static readonly layer: Layer.Layer<ConfigLoader> = Layer.sync(ConfigLoader, () =>
    ConfigLoader.of({
      load: (cwd) =>
        Effect.tryPromise({
          try: () => loadConfigFrom(cwd),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        }),
    }),
  );
}
