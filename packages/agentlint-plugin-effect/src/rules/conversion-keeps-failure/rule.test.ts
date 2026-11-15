import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { describe, expect, it } from "vitest";
import { conversionKeepsFailure } from "./rule.js";

const header = 'import { Effect, Schema, Stream } from "effect";\n';

const findings = async (body: string, file = "src/rpc.ts", imports = header) =>
  testRuleOnSource({ rule: conversionKeepsFailure, source: `${imports}${body}\n`, file });

const fires = async (body: string, imports?: string): Promise<boolean> =>
  (await findings(body, "src/rpc.ts", imports)).length > 0;

describe("reports a failure replaced unread", () => {
  it.each([
    ["no parameter", "x.pipe(Effect.mapError(() => E.make({})));"],
    ["an unused parameter", "x.pipe(Effect.mapError((_failure) => E.make({})));"],
    ["a function expression", "x.pipe(Effect.mapError(function () { return E.make({}); }));"],
    ["a mapper that is not a constructor", "x.pipe(Effect.mapError(() => unavailable()));"],
    ["the data-first form", "Effect.mapError(store.read(), () => E.make({}));"],
    ["orElseFail", "x.pipe(Effect.orElseFail(() => E.make({})));"],
    ["a Stream", "x.pipe(Stream.mapError(() => E.make({})));"],
    ["catch answering a new error", "x.pipe(Effect.catch(() => new E()));"],
    ["catch answering make", "x.pipe(Effect.catch(() => E.make({})));"],
    ["catch answering Effect.fail", "x.pipe(Effect.catch(() => Effect.fail(new E())));"],
    ["catch with a block", "x.pipe(Effect.catch(() => { return E.make({}); }));"],
    ["tryPromise", "Effect.tryPromise({ try: () => load(), catch: () => new E() });"],
    ["try", "Effect.try({ try: () => parse(), catch: () => new E() });"],
    [
      "a step that can fail after an absent value",
      "Effect.fromOption(a).pipe(Effect.flatMap(read), Effect.mapError(() => E.make({})));",
    ],
    [
      "an Effect.fn step, whose origin is unknown",
      'Effect.fn("x")(function* () {}, Effect.mapError(() => E.make({})));',
    ],
  ])("%s", async (_label, body) => {
    expect(await fires(body)).toBe(true);
  });

  it("names the operator and what survives", async () => {
    const [finding] = await findings("store.read().pipe(Effect.mapError(() => E.make({})));");
    expect(finding?.message).toContain("Effect.mapError replaces a failure");
    expect(finding?.message).toContain("E.make({})");
  });

  it("reopens an acceptance when the converted effect changes", async () => {
    const [before] = await findings("store.read().pipe(Effect.mapError(() => E.make({})));");
    const [after] = await findings("provider.send().pipe(Effect.mapError(() => E.make({})));");
    expect(after?.fingerprint.digest).not.toBe(before?.fingerprint.digest);
  });

  it("follows a renamed namespace", async () => {
    expect(await fires("x.pipe(E.mapError(() => Failure.make({})));", 'import * as E from "effect/Effect";\n')).toBe(
      true,
    );
    expect(
      await fires("x.pipe(Fx.mapError(() => Failure.make({})));", 'import { Effect as Fx } from "effect";\n'),
    ).toBe(true);
  });
});

describe("stays silent", () => {
  it.each([
    ["the failure as a cause", "x.pipe(Effect.mapError((cause) => E.make({ cause })));"],
    ["a field of the failure", "x.pipe(Effect.mapError((failure) => E.make({ reason: failure.reason })));"],
    ["a destructured failure", "x.pipe(Effect.mapError(({ reason }) => E.make({ reason })));"],
    ["a failure returned as it is", "x.pipe(Effect.mapError((failure) => failure));"],
    ["a named mapper", "x.pipe(Effect.mapError(toUnavailable));"],
    [
      "tryPromise reading what was thrown",
      "Effect.tryPromise({ try: () => load(), catch: (cause) => new E({ cause }) });",
    ],
    ["tryPromise in its short form", "Effect.tryPromise(() => load());"],
    ["fromOption", "Effect.fromOption(a).pipe(Effect.mapError(() => E.make({})));"],
    ["fromOption, data first", "Effect.mapError(Effect.fromOption(a), () => E.make({}));"],
    ["fromOption through a pure step", "Effect.fromOption(a).pipe(Effect.map(f), Effect.mapError(() => E.make({})));"],
    ["fromNullishOr", "Effect.fromNullishOr(a).pipe(Effect.mapError(() => E.make({})));"],
    ["a curried decoder", "Schema.decodeEffect(S)(raw).pipe(Effect.mapError(() => E.make({})));"],
    ["a local decoder", "decodeWire(raw).pipe(Effect.mapError(() => E.make({})));"],
    ["tapError first", "x.pipe(Effect.tapError(log), Effect.mapError(() => E.make({})));"],
    ["tapCause first", "x.pipe(Effect.tapCause(log), Effect.mapError(() => E.make({})));"],
    ["a recovery", "x.pipe(Effect.catch(() => Effect.succeed([])));"],
    ["a fallback built with an Effect module", "x.pipe(Effect.catch(() => Stream.make(1)));"],
    ["a promise catch", "load().catch(() => new E());"],
  ])("%s", async (_label, body) => {
    expect(await fires(body)).toBe(false);
  });

  it("in a file that does not import Effect", async () => {
    expect(await fires("x.pipe(Effect.mapError(() => E.make({})));", "")).toBe(false);
  });

  it("for an Effect name imported from another package", async () => {
    expect(
      await fires("x.pipe(Effect.mapError(() => E.make({})));", 'import { Effect } from "./my-effect.js";\n'),
    ).toBe(false);
  });
});
