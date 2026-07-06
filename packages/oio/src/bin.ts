#!/usr/bin/env node
/**
 * CLI entry point for `oio`, the Theme OS CLI.
 */

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Console, Effect, Layer } from "effect";
import { defaultBudgets, defaultStatuses, type OioConfig } from "./config.js";
import { Env } from "./env.js";
import { budgetHandler } from "./features/budget/handler.js";
import { BudgetCommand } from "./features/budget/request.js";
import { docsBuildHandler } from "./features/docs/handler.js";
import { DocsBuildCommand } from "./features/docs/request.js";
import { registryCheckHandler, registrySyncHandler } from "./features/registry/handler.js";
import { RegistryCheckCommand, RegistrySyncCommand } from "./features/registry/request.js";
import { scaffoldHandler } from "./features/scaffold/handler.js";
import { ScaffoldCommand, type ScaffoldKind } from "./features/scaffold/request.js";
import { surfaceAuditHandler } from "./features/surface/handler.js";
import { SurfaceAuditCommand } from "./features/surface/request.js";
import { ConfigLoader } from "./shared/config-loader.js";

const scaffoldKinds = new Set(["block", "snippet", "section", "enhancer", "machine"]);

function usage(): string {
  return [
    "oio - Theme OS CLI",
    "",
    "Commands:",
    "  oio registry check          verify markdown registry <-> registry.json",
    "  oio registry sync           write registry.json from the markdown registry",
    "  oio surface audit           print the merchant-facing catalog",
    "  oio budget                  check asset size budgets",
    "  oio docs build              generate the primitive catalog, event docs, and llms.txt",
    "  oio scaffold <kind> <id>    kind: block|snippet|section|enhancer|machine",
  ].join("\n");
}

const printResult = (result: { readonly lines: readonly string[]; readonly exitCode: number }) =>
  Effect.gen(function* () {
    for (const line of result.lines) {
      yield* Console.log(line);
    }
    const env = yield* Env;
    env.setExitCode(result.exitCode);
  });

const registryDefaults = (config: OioConfig) => ({
  markdownPath: config.registry?.markdownPath ?? "docs/theme-os/primitive-registry.md",
  jsonPath: config.registry?.jsonPath ?? "registry.json",
  statuses: config.registry?.statuses ?? defaultStatuses,
  minCount: config.registry?.minCount ?? 0,
});

const program = Effect.gen(function* () {
  const env = yield* Env;
  const configLoader = yield* ConfigLoader;
  const [command, subcommand, ...rest] = env.argv;
  const config = yield* configLoader.load(env.cwd);
  const registry = registryDefaults(config);

  switch (command) {
    case "registry": {
      if (subcommand === "check") {
        return yield* printResult(
          yield* registryCheckHandler(new RegistryCheckCommand({ root: env.cwd, ...registry })),
        );
      }
      if (subcommand === "sync") {
        return yield* printResult(
          yield* registrySyncHandler(
            new RegistrySyncCommand({
              root: env.cwd,
              markdownPath: registry.markdownPath,
              jsonPath: registry.jsonPath,
              statuses: registry.statuses,
            }),
          ),
        );
      }
      yield* Console.log("Usage: oio registry check|sync");
      env.setExitCode(2);
      return;
    }
    case "surface": {
      if (subcommand === "audit") {
        return yield* printResult(
          yield* surfaceAuditHandler(new SurfaceAuditCommand({ root: env.cwd, jsonPath: registry.jsonPath })),
        );
      }
      yield* Console.log("Usage: oio surface audit");
      env.setExitCode(2);
      return;
    }
    case "budget": {
      return yield* printResult(
        yield* budgetHandler(new BudgetCommand({ root: env.cwd, budgets: config.budgets ?? defaultBudgets })),
      );
    }
    case "docs": {
      if (subcommand === "build") {
        return yield* printResult(
          yield* docsBuildHandler(
            new DocsBuildCommand({
              root: env.cwd,
              jsonPath: registry.jsonPath,
              eventsPath: config.docs?.eventsPath,
              outputDir: config.docs?.outputDir ?? "docs/generated",
            }),
          ),
        );
      }
      yield* Console.log("Usage: oio docs build");
      env.setExitCode(2);
      return;
    }
    case "scaffold": {
      const id = rest[0];
      if (subcommand === undefined || !scaffoldKinds.has(subcommand) || id === undefined) {
        yield* Console.log("Usage: oio scaffold block|snippet|section|enhancer|machine <id>");
        env.setExitCode(2);
        return;
      }
      return yield* printResult(
        yield* scaffoldHandler(
          new ScaffoldCommand({
            root: env.cwd,
            kind: subcommand as ScaffoldKind,
            id,
            namespace: config.namespace ?? "oio",
            jsonPath: registry.jsonPath,
          }),
        ),
      );
    }
    case undefined:
    case "--help":
    case "-h": {
      yield* Console.log(usage());
      return;
    }
    default: {
      yield* Console.log(usage());
      env.setExitCode(2);
    }
  }
}).pipe(
  Effect.catch((error: unknown) =>
    Effect.gen(function* () {
      const env = yield* Env;
      const message =
        typeof error === "object" && error !== null && "message" in error ? String(error.message) : String(error);
      yield* Console.log(`oio error: ${message}`);
      env.setExitCode(2);
    }),
  ),
);

const AppLayer = Layer.mergeAll(ConfigLoader.layer, Env.layer);

const runnable = program.pipe(Effect.provide(AppLayer)) as Effect.Effect<void>;

NodeRuntime.runMain(runnable);
