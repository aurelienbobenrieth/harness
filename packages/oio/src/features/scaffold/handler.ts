import path from "node:path";
import { Effect } from "effect";
import { parseJsonRegistry, serializeRegistry, type RegistryEntry } from "../../domain/registry.js";
import { fileExists, readTextFile, writeTextFile } from "../../shared/fs-support.js";
import { ScaffoldCommand, ScaffoldResult } from "./request.js";
import { planScaffold } from "./templates.js";

function nameFromId(id: string): string {
  const segments = id.split(".");
  return segments.at(-1) ?? id;
}

export const scaffoldHandler = Effect.fn("scaffoldHandler")(function* (command: ScaffoldCommand) {
  const name = nameFromId(command.id);
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    return new ScaffoldResult({
      lines: [`invalid id "${command.id}": the final segment must be kebab-case`],
      exitCode: 2,
    });
  }

  const plan = planScaffold(command.kind, name, command.namespace);

  for (const file of plan.files) {
    const target = path.join(command.root, file.relativePath);
    if (yield* Effect.promise(() => fileExists(target))) {
      return new ScaffoldResult({ lines: [`refusing to overwrite ${file.relativePath}`], exitCode: 2 });
    }
  }

  const lines: string[] = [];
  for (const file of plan.files) {
    yield* Effect.promise(() => writeTextFile(path.join(command.root, file.relativePath), file.content));
    lines.push(`created ${file.relativePath}`);
  }

  const jsonPath = path.join(command.root, command.jsonPath);
  const jsonContent = yield* Effect.promise(() => readTextFile(jsonPath));
  const entries = (jsonContent === undefined ? undefined : parseJsonRegistry(jsonContent)) ?? [];
  const existing = entries.find((entry) => entry.id === command.id);

  const updatedEntry: RegistryEntry = {
    id: command.id,
    name: existing?.name ?? name,
    status: "skeleton",
    surface: existing?.surface ?? plan.surface,
    delivery: existing?.delivery ?? plan.delivery,
    path: plan.registryPath,
  };
  const primitives =
    existing === undefined
      ? [...entries, updatedEntry]
      : entries.map((entry) => (entry.id === command.id ? updatedEntry : entry));

  yield* Effect.promise(() => writeTextFile(jsonPath, serializeRegistry(primitives)));
  lines.push(
    existing === undefined
      ? `registered ${command.id} as skeleton in ${command.jsonPath}`
      : `flipped ${command.id} to skeleton in ${command.jsonPath}`,
  );
  lines.push("remember: mirror the status in the markdown registry before `oio registry check`.");

  return new ScaffoldResult({ lines, exitCode: 0 });
});
