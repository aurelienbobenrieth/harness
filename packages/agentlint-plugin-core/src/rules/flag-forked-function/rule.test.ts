import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineFlagForkedFunction, flagForkedFunction } from "./rule.js";

const messageFor = (...flags: readonly string[]): string =>
  `Parameter${flags.length > 1 ? "s" : ""} ${flags.map((flag) => `\`${flag}\``).join(", ")} only select${flags.length > 1 ? "" : "s"} a code path; split the function by intent, or show that callers derive the flag from runtime data.`;

async function messages(
  source: string,
  file = "src/invoice.ts",
  rule = flagForkedFunction,
): Promise<readonly string[]> {
  return (await testRuleOnSource({ rule: rule, source: source, file: file })).map((finding) => finding.message);
}

it("reports two defaulted option flags that are only ever tested", async () => {
  const source = `
export function renderInvoice({ invoice, forCreditNote = false, draft = false }: RenderInput) {
  if (forCreditNote) return renderCredit(invoice);
  const header = draft ? draftHeader(invoice) : finalHeader(invoice);
  return layout(header, invoice.lines);
}`;
  expect(await messages(source)).toEqual([messageFor("draft", "forCreditNote")]);
});

it("reports one literal-union parameter that drives three conditionals", async () => {
  const source = `
export function send(message: Message, mode: "email" | "sms") {
  const body = mode === "email" ? html(message) : text(message);
  if (mode === "sms") truncate(body);
  switch (mode) {
    case "email":
      return smtp.send(body);
    case "sms":
      return gateway.send(body);
  }
}`;
  expect(await messages(source)).toEqual([messageFor("mode")]);
});

it("reports a private function whose in-file caller passes a literal", async () => {
  const source = `
function exportReport(report: Report, asPdf: boolean, archive?: boolean) {
  if (asPdf && !archive) return streamPdf(report);
  if (archive) return store(report);
  return streamCsv(report);
}
exportReport(current, true, shouldArchive);`;
  expect(await messages(source)).toEqual([messageFor("archive", "asPdf")]);
});

it("reads literals passed through an options object", async () => {
  const source = `
const build = ({ entry, minify = false, watch = false }) => {
  if (watch) return serve(entry);
  return minify ? compress(bundle(entry)) : bundle(entry);
};
build({ entry: "src/index.ts", watch: true });`;
  expect(await messages(source)).toEqual([messageFor("minify", "watch")]);
});

it("stays silent when every in-file caller passes runtime values", async () => {
  const source = `
function exportReport(report: Report, asPdf: boolean, archive: boolean) {
  if (asPdf) return streamPdf(report);
  if (archive) return store(report);
  return streamCsv(report);
}
exportReport(current, request.query.pdf, user.settings.archive);
const build = ({ entry, minify = false, watch = false }) => (watch ? serve(entry) : minify ? a(entry) : b(entry));
build({ entry, minify, watch: options.watch });`;
  expect(await messages(source)).toEqual([]);
});

it("stays silent when a flag is forwarded or stored as data", async () => {
  const forwarded = `
export function save(order: Order, validate: boolean, notify: boolean) {
  if (validate) check(order);
  return repository.save(order, notify);
}`;
  const stored = `
export function createJob(payload: Payload, urgent: boolean, retry = true) {
  if (urgent) bump(payload);
  return { payload, retry };
}`;
  const mixed = `
export function createJob(payload: Payload, urgent: boolean, retry: boolean) {
  if (urgent) bump(payload);
  if (retry) schedule(payload);
  return { payload, urgent, attempts: retry ? 3 : 1 };
}`;
  expect(await messages(forwarded)).toEqual([]);
  expect(await messages(stored)).toEqual([]);
  expect(await messages(mixed)).toEqual([]);
});

it("stays silent on one flag tested fewer than three times", async () => {
  const source = `
export function send(message: Message, mode: "email" | "sms") {
  const body = mode === "email" ? html(message) : text(message);
  if (mode === "sms") truncate(body);
  return deliver(body);
}`;
  expect(await messages(source)).toEqual([]);
});

it("does not treat comparisons against runtime values or non-flag types as flags", async () => {
  const compared = `
export function pick(items: Item[], strict: boolean, deep: boolean) {
  if (strict === settings.strict) return items;
  if (deep) return flatten(items);
  return items.slice(0, 1);
}`;
  const typed = `
export function pick(items: Item[], limit: number, label: string) {
  if (limit) trim(items);
  if (label) tag(items);
  return items;
}`;
  expect(await messages(compared)).toEqual([]);
  expect(await messages(typed)).toEqual([]);
});

it("leaves component files alone unless asked", async () => {
  const source = `
export function Button({ label, disabled = false, compact = false }: ButtonProps) {
  if (disabled) return renderDisabled(label);
  return compact ? renderCompact(label) : renderFull(label);
}`;
  expect(await messages(source, "src/button.tsx")).toEqual([]);
  expect(await messages(source, "src/button.tsx", defineFlagForkedFunction({ includeJsx: true }))).toEqual([
    messageFor("compact", "disabled"),
  ]);
  expect(flagForkedFunction.binding.exclude).toContain("**/*.{tsx,jsx}");
  expect(defineFlagForkedFunction({ includeJsx: true }).binding.exclude).not.toContain("**/*.{tsx,jsx}");
});

it("honours thresholds, mirrors options and excludes test files", async () => {
  const source = "export function run(job: Job, dry: boolean) { if (dry) return plan(job); return apply(job); }";
  expect(await messages(source)).toEqual([]);
  expect(await messages(source, "src/run.ts", defineFlagForkedFunction({ minFlags: 1 }))).toEqual([messageFor("dry")]);
  expect(flagForkedFunction.binding.options).toEqual({
    minFlags: null,
    minSitesForSingleFlag: null,
    includeJsx: null,
  });
  expect(defineFlagForkedFunction({ minFlags: 3, minSitesForSingleFlag: 4, includeJsx: true }).binding.options).toEqual(
    {
      minFlags: 3,
      minSitesForSingleFlag: 4,
      includeJsx: true,
    },
  );
  expect(flagForkedFunction.binding.exclude).toEqual(
    expect.arrayContaining(["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"]),
  );
  expect(() => defineFlagForkedFunction({ minFlags: 0 })).toThrow("minFlags");
});
