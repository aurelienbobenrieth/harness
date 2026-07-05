import path from "node:path";
import { Effect } from "effect";
import {
  diffRegistries,
  mergeRegistries,
  parseJsonRegistry,
  parseMarkdownRegistry,
  serializeRegistry,
} from "../../domain/registry.js";
import { readTextFile, writeTextFile } from "../../shared/fs-support.js";
import { RegistryCheckCommand, RegistryResult, RegistrySyncCommand } from "./request.js";

export const registryCheckHandler = Effect.fn("registryCheckHandler")(function* (command: RegistryCheckCommand) {
  const lines: string[] = [];
  const markdown = yield* Effect.promise(() => readTextFile(path.join(command.root, command.markdownPath)));
  if (markdown === undefined) {
    return new RegistryResult({ lines: [`${command.markdownPath} not found`], exitCode: 2 });
  }

  const markdownEntries = parseMarkdownRegistry(markdown, command.statuses);
  if (markdownEntries.length < command.minCount) {
    lines.push(`registry has ${markdownEntries.length} entries, expected at least ${command.minCount}`);
  }

  const statusCounts = new Map<string, number>();
  for (const entry of markdownEntries) {
    statusCounts.set(entry.status, (statusCounts.get(entry.status) ?? 0) + 1);
  }

  const jsonContent = yield* Effect.promise(() => readTextFile(path.join(command.root, command.jsonPath)));
  const jsonEntries = jsonContent === undefined ? undefined : parseJsonRegistry(jsonContent);
  if (jsonEntries === undefined) {
    lines.push(`${command.jsonPath} missing or invalid: run \`oio registry sync\``);
  } else {
    const drift = diffRegistries(markdownEntries, jsonEntries);
    for (const id of drift.duplicateIds) lines.push(`duplicate id in markdown: ${id}`);
    for (const id of drift.missingInJson) lines.push(`missing in ${command.jsonPath}: ${id}`);
    for (const id of drift.extraInJson) lines.push(`extra in ${command.jsonPath}: ${id}`);
    for (const mismatch of drift.statusMismatches) {
      lines.push(`status drift for ${mismatch.id}: markdown=${mismatch.markdown} json=${mismatch.json}`);
    }
  }

  const summary = [...statusCounts.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${status}:${count}`)
    .join(" ");

  if (lines.length === 0) {
    return new RegistryResult({
      lines: [`registry in sync (${markdownEntries.length} entries) ${summary}`],
      exitCode: 0,
    });
  }
  return new RegistryResult({ lines: [...lines, summary], exitCode: 1 });
});

export const registrySyncHandler = Effect.fn("registrySyncHandler")(function* (command: RegistrySyncCommand) {
  const markdown = yield* Effect.promise(() => readTextFile(path.join(command.root, command.markdownPath)));
  if (markdown === undefined) {
    return new RegistryResult({ lines: [`${command.markdownPath} not found`], exitCode: 2 });
  }

  const markdownEntries = parseMarkdownRegistry(markdown, command.statuses);
  const jsonPath = path.join(command.root, command.jsonPath);
  const jsonContent = yield* Effect.promise(() => readTextFile(jsonPath));
  const jsonEntries = (jsonContent === undefined ? undefined : parseJsonRegistry(jsonContent)) ?? [];

  const { primitives, summary } = mergeRegistries(markdownEntries, jsonEntries);
  yield* Effect.promise(() => writeTextFile(jsonPath, serializeRegistry(primitives)));

  const lines = [
    `wrote ${command.jsonPath} with ${primitives.length} entries`,
    `added ${summary.added.length}, updated ${summary.updated.length}, removed ${summary.removed.length}`,
  ];
  for (const id of summary.removed) lines.push(`removed (not in markdown): ${id}`);
  return new RegistryResult({ lines, exitCode: 0 });
});
