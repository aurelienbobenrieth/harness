import path from "node:path";
import { Effect } from "effect";
import { parseJsonRegistry, type RegistryEntry } from "../../domain/registry.js";
import { readTextFile } from "../../shared/fs-support.js";
import { SurfaceAuditCommand, SurfaceAuditResult } from "./request.js";

function catalogLine(entry: RegistryEntry): string {
  return `  ${entry.id.padEnd(36)} ${(entry.delivery ?? "?").padEnd(10)} ${entry.status.padEnd(12)} ${entry.path ?? ""}`;
}

export const surfaceAuditHandler = Effect.fn("surfaceAuditHandler")(function* (command: SurfaceAuditCommand) {
  const content = yield* Effect.promise(() => readTextFile(path.join(command.root, command.jsonPath)));
  const entries = content === undefined ? undefined : parseJsonRegistry(content);
  if (entries === undefined) {
    return new SurfaceAuditResult({
      lines: [`${command.jsonPath} missing or invalid: run \`oio registry sync\``],
      exitCode: 2,
    });
  }

  const lines: string[] = [];
  const bySurface = new Map<string, RegistryEntry[]>();
  for (const entry of entries) {
    const surface = entry.surface ?? "unclassified";
    const bucket = bySurface.get(surface) ?? [];
    bucket.push(entry);
    bySurface.set(surface, bucket);
  }

  const merchant = (bySurface.get("merchant") ?? []).toSorted((a, b) => a.id.localeCompare(b.id));
  lines.push(`merchant-facing catalog (${merchant.length}):`);
  for (const entry of merchant) lines.push(catalogLine(entry));

  for (const surface of ["preset", "contract", "internal"]) {
    const bucket = bySurface.get(surface) ?? [];
    lines.push(`${surface}: ${bucket.length}`);
  }

  const unclassified = (bySurface.get("unclassified") ?? []).filter(
    (entry) => entry.status !== "proposed" && entry.status !== "rejected",
  );
  if (unclassified.length > 0) {
    lines.push(`unclassified non-proposed entries (${unclassified.length}):`);
    for (const entry of unclassified.toSorted((a, b) => a.id.localeCompare(b.id))) {
      lines.push(catalogLine(entry));
    }
  }

  return new SurfaceAuditResult({ lines, exitCode: unclassified.length > 0 ? 1 : 0 });
});
