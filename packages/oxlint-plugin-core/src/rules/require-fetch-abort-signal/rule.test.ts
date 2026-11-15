import { expect, it } from "vitest";
import { assertRuleDoesNotReport, assertRuleReports } from "../test-support.js";

const ruleName = "core/require-fetch-abort-signal";
const reports = (code: string, filename?: string) =>
  assertRuleReports(ruleName, code, filename === undefined ? {} : { filename });
const silent = (code: string, filename?: string) =>
  assertRuleDoesNotReport(ruleName, code, filename === undefined ? {} : { filename });

it("reports fetch without options", async () => {
  await expect(reports('await fetch("https://api.example.com/config");\n')).resolves.toBeUndefined();
});

it("reports fetch options without signal", async () => {
  await expect(
    reports('await fetch("https://api.example.com/config", { method: "POST" });\n'),
  ).resolves.toBeUndefined();
});

it("reports window, globalThis and self qualified fetch", async () => {
  await expect(reports('await window.fetch("/x");\n')).resolves.toBeUndefined();
  await expect(reports('await globalThis.fetch("/x");\n')).resolves.toBeUndefined();
  await expect(reports('await self.fetch("/x");\n')).resolves.toBeUndefined();
});

it("reports a nullish init or signal", async () => {
  await expect(reports('fetch("/api", undefined);')).resolves.toBeUndefined();
  await expect(reports('fetch("/api", { signal: undefined });')).resolves.toBeUndefined();
  await expect(reports('fetch("/api", { signal: null });')).resolves.toBeUndefined();
});

it("reports a spread that can override the signal or hides it", async () => {
  await expect(reports('fetch("/api", { signal: controller.signal, ...options });')).resolves.toBeUndefined();
  await expect(reports('fetch("/api", { ...requestInit });')).resolves.toBeUndefined();
  await expect(reports('const init = {}; fetch("/api", init);')).resolves.toBeUndefined();
});

it("reports a spread of an object literal that sets the signal again", async () => {
  await expect(reports('fetch("/api", { signal, ...{ signal: undefined } });')).resolves.toBeUndefined();
});

it("reports fetch in an ordinary Effect-free async function", async () => {
  await expect(
    reports('export async function load() { return fetch("/api", { method: "GET" }); }'),
  ).resolves.toBeUndefined();
});

it("reports a Request without signal", async () => {
  await expect(reports('fetch(new Request("/api", { method: "POST" }));')).resolves.toBeUndefined();
});

it("reports an Effect thunk that already accepts the signal but does not use it", async () => {
  await expect(
    reports('Effect.tryPromise({ try: (signal) => fetch("/api"), catch: String });'),
  ).resolves.toBeUndefined();
});

it("ignores fetch with a signal", async () => {
  await expect(silent('await fetch("/api", { signal });')).resolves.toBeUndefined();
  await expect(silent('await fetch("/api", { signal: AbortSignal.timeout(1000) });')).resolves.toBeUndefined();
  await expect(silent('await fetch("/api", { "signal": controller.signal });')).resolves.toBeUndefined();
  await expect(silent('await window.fetch("/api", { signal });')).resolves.toBeUndefined();
});

it("ignores a signal followed only by named properties and a signal after a spread", async () => {
  await expect(silent('fetch("/api", { ...base, signal });')).resolves.toBeUndefined();
  await expect(silent('fetch("/api", { signal, method: "POST" });')).resolves.toBeUndefined();
});

it("ignores a literal spread that holds no signal after the signal", async () => {
  await expect(
    silent('fetch("/api", { signal, ...(body === undefined ? {} : { body }), ...{ method: "POST" } });'),
  ).resolves.toBeUndefined();
});

it("ignores data URLs", async () => {
  await expect(silent('await fetch("data:,");')).resolves.toBeUndefined();
});

it("ignores an init forwarded from a parameter", async () => {
  await expect(
    silent("export const request = (url: string, init?: RequestInit) => fetch(url, init);"),
  ).resolves.toBeUndefined();
  await expect(
    silent("export const request = (url: string, init: RequestInit) => fetch(url, { ...init, method: 'GET' });"),
  ).resolves.toBeUndefined();
});

it("ignores a Request that carries a signal", async () => {
  await expect(silent('fetch(new Request("/api", { signal: controller.signal }));')).resolves.toBeUndefined();
});

it("ignores a Request object received as a parameter", async () => {
  await expect(silent("export const proxy = (request: Request) => fetch(request);")).resolves.toBeUndefined();
  await expect(silent("export const proxy = (input: Request) => fetch(input);")).resolves.toBeUndefined();
  await expect(
    silent("export const clone = (request: Request) => fetch(new Request(request));"),
  ).resolves.toBeUndefined();
  await expect(reports("export const load = (url: string) => fetch(new Request(url));")).resolves.toBeUndefined();
});

it("ignores a locally defined or imported fetch", async () => {
  await expect(silent('const fetch = makeFetch(); fetch("/api");')).resolves.toBeUndefined();
  await expect(silent('import { fetch } from "undici"; fetch("/api");')).resolves.toBeUndefined();
});

it("ignores test and test-support files", async () => {
  await expect(silent('await fetch("/api");', "src/client.test.ts")).resolves.toBeUndefined();
  await expect(silent('await fetch("/api");', "e2e/smoke.ts")).resolves.toBeUndefined();
  await expect(silent('await fetch("/api");', "src/__tests__/client.ts")).resolves.toBeUndefined();
});

it("leaves a parameterless Effect.tryPromise or Effect.promise thunk to effect/require-abort-signal", async () => {
  await expect(silent('Effect.tryPromise({ try: () => fetch("/api"), catch: String });')).resolves.toBeUndefined();
  await expect(silent('Effect.tryPromise(() => fetch("/api"));')).resolves.toBeUndefined();
  await expect(silent('Effect.promise(async () => { await fetch("/api"); });')).resolves.toBeUndefined();
});
