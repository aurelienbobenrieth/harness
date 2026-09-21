import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineTestBehaviorCoverage, testBehaviorCoverage } from "./rule.js";

const noAssertionMessage =
  "Test file is dense in mocks but asserts no observable outcome; pin returned state or output.";
const denseInteractionMessage =
  "Test file is dense in mocks and asserts mock interactions only; pin returned state or output, or show that each mocked collaborator is an unmanaged process boundary.";
const interactionOnlyMessage = (count: number, total: number, doubles: readonly string[]): string =>
  `${count} of ${total} tests assert mock interactions only (${doubles.map((double) => `\`${double}\``).join(", ")}); assert the resulting state or return value, or show that each listed double is an unmanaged process boundary.`;
const snapshotOnlyMessage = (count: number): string =>
  `${count} tests rely on a snapshot of a whole value as their only oracle; assert the two or three facts that must not change, or show that the full text is the contract.`;

async function messagesFor(
  source: string,
  file = "src/user.test.ts",
  rule = testBehaviorCoverage,
): Promise<readonly string[]> {
  return (await testRuleOnSource(rule, source, file)).map((finding) => finding.message);
}

const mirrorWareSource = `
const repo = createMock();
const mailer = fakeMailer();
const send = vi.fn();
it("calls the repo", () => {
  service.register(input);
  expect(send).toHaveBeenCalled();
});
`;

const behaviorSource = `
const repo = createMock();
const mailer = fakeMailer();
const send = vi.fn();
it("registers the user", () => {
  const result = service.register(input);
  expect(result.email).toEqual("a@b.co");
});
`;

it("reports mock-dense test files without outcome assertions, once per file", async () => {
  expect(await messagesFor(mirrorWareSource)).toEqual([denseInteractionMessage]);
  expect(await messagesFor(mirrorWareSource, "src/other.spec.tsx")).toEqual([denseInteractionMessage]);
});

it("ignores non-test files", async () => {
  expect(await messagesFor(mirrorWareSource, "src/user.ts")).toEqual([]);
});

it("ignores mock-dense suites that pin an observable outcome", async () => {
  expect(await messagesFor(behaviorSource)).toEqual([]);
});

it("ignores a lone test below the mock-density threshold that pins an outcome next to a call", async () => {
  const source =
    'const repo = createMock();\nit("works", () => { expect(service.run()).toBe(1); expect(spy).toHaveBeenCalled(); });\n';
  expect(await messagesFor(source)).toEqual([]);
});

it("ignores mock-dense suites whose outcomes are property assertions", async () => {
  const source = `${mirrorWareSource.replace("expect(send).toHaveBeenCalled();", "")}
it("round-trips", () => {
  fc.assert(fc.property(fc.string(), (s) => decode(encode(s)) === s));
});`;
  expect(await messagesFor(source)).toEqual([]);
});

it("does not let argument-level interaction matchers stand in for an outcome", async () => {
  const source = `
const repo = createMock();
const mailer = fakeMailer();
const send = vi.fn();
it("sends the welcome mail", () => {
  service.register(input);
  expect(send).toHaveBeenCalledWith({ to: "a@b.co" });
  expect(repo.save).toHaveBeenCalledTimes(1);
  expect(mailer.deliver).toHaveBeenNthCalledWith(1, "welcome");
});
`;
  expect(await messagesFor(source)).toEqual([denseInteractionMessage]);
});

it("distinguishes a mock-dense file with no assertion at all", async () => {
  expect(await messagesFor("const a = vi.fn(); const b = vi.fn(); const c = vi.fn(); service.run(a, b, c);")).toEqual([
    noAssertionMessage,
  ]);
});

const withOutcome = (assertion: string): string => `
const repo = createMock();
const mailer = fakeMailer();
const send = vi.fn();
it("registers", async () => {
  expect(send).toHaveBeenCalledWith(input);
  ${assertion}
});
`;

it("accepts interaction assertions that sit next to a state, error, or output assertion", async () => {
  expect(await messagesFor(withOutcome('expect(result.status).toBe("registered");'))).toEqual([]);
  expect(
    await messagesFor(withOutcome('await expect(service.register(bad)).rejects.toThrow("invalid email");')),
  ).toEqual([]);
  expect(await messagesFor(withOutcome("expect(view).toMatchInlineSnapshot();"))).toEqual([]);
});

it("keeps interaction matchers out of a custom outcome pattern", async () => {
  const rule = defineTestBehaviorCoverage({
    outcomePattern: /\.toHaveBeenCalledWith\s*\(|\.toEqual\s*\(/,
  });
  const source = mirrorWareSource.replace("toHaveBeenCalled()", "toHaveBeenCalledWith(1)");
  expect(await messagesFor(source, "src/user.test.ts", rule)).toEqual([denseInteractionMessage]);
});

it("reports interaction-only tests without needing three mocks, naming each double", async () => {
  const source = `
const pricing = { quote: spy() };
const repo = { save: spy() };
it("prices the order", async () => {
  await checkout.place(order);
  expect(pricing.quote).toHaveBeenCalledWith(order.lines);
});
it("stores the order", async () => {
  await checkout.place(order);
  expect(repo.save).toHaveBeenCalledTimes(1);
  expect(repo.save).toHaveBeenCalledWith(order);
});`;
  expect(await messagesFor(source)).toEqual([interactionOnlyMessage(2, 2, ["pricing.quote", "repo.save"])]);
});

it("judges each test on its own, so one outcome test does not excuse the rest", async () => {
  const source = `
it("totals the cart", () => {
  expect(total(cart)).toEqual(30);
});
it("notifies", () => { run(); expect(notify).toHaveBeenCalledWith("done"); });
it("logs", () => { run(); expect(log).toBeCalledTimes(1); });
it("audits", async () => { await run(); expect(audit.record).toHaveBeenLastCalledWith("run"); });`;
  expect(await messagesFor(source)).toEqual([interactionOnlyMessage(3, 4, ["audit.record", "log", "notify"])]);
});

it("reports a single interaction-only test when it is at least half of the file", async () => {
  const source = `
it("notifies", () => { run(); expect(notify).toHaveBeenCalledWith("done"); });
it("totals", () => { expect(total(cart)).toBe(30); });`;
  expect(await messagesFor(source)).toEqual([interactionOnlyMessage(1, 2, ["notify"])]);
  expect(
    await messagesFor(source, "src/user.test.ts", defineTestBehaviorCoverage({ minInteractionShare: 0.75 })),
  ).toEqual([]);
});

const outcome = (name: string): string => `it("${name}", () => { expect(total(cart)).toBe(30); });`;

it("stays silent on one interaction-only test out of five", async () => {
  const source = `
it("notifies", () => { run(); expect(notify).toHaveBeenCalledWith("done"); });
${["a", "b", "c", "d"].map(outcome).join("\n")}`;
  expect(await messagesFor(source)).toEqual([]);
});

it("stays silent on tests that mix an interaction with an outcome or a property", async () => {
  const source = `
it("saves and returns", async () => {
  const saved = await service.save(order);
  expect(repo.save).toHaveBeenCalledWith(order);
  expect(saved.id).toEqual("o1");
});
it("emits for any input", () => {
  fc.assert(fc.property(fc.string(), (s) => { emit(s); expect(listener).toHaveBeenCalledWith(s); }));
});
it.each([1, 2])("forwards %s", (n) => {
  forward(n);
  expect(sink).toHaveBeenCalledWith(n);
  expect(sink.mock.results[0]?.value).toBe(n);
});`;
  expect(await messagesFor(source)).toEqual([]);
});

it("does not add the per-test finding when the file-density finding already fired", async () => {
  const source = `
const a = vi.fn();
const b = vi.fn();
const c = vi.fn();
it("one", () => { run(a); expect(a).toHaveBeenCalled(); });
it("two", () => { run(b); expect(b).toHaveBeenCalledWith(1); });`;
  expect(await messagesFor(source)).toEqual([denseInteractionMessage]);
});

it("reports tests whose only oracle is a snapshot of a whole value", async () => {
  const source = `
it("renders", () => {
  const { container } = render(view);
  expect(container).toMatchSnapshot();
});
it("renders empty", () => {
  expect(asFragment()).toMatchSnapshot();
});`;
  expect(await messagesFor(source)).toEqual([snapshotOnlyMessage(2)]);
});

it("reports over-long inline snapshots even on a member access", async () => {
  const body = Array.from({ length: 14 }, (_, line) => `  line ${line}`).join("\n");
  const test = (name: string): string =>
    `it("${name}", () => { expect(report.text).toMatchInlineSnapshot(\`\n${body}\n\`); });`;
  const source = `${test("a")}\n${test("b")}`;
  expect(await messagesFor(source)).toEqual([snapshotOnlyMessage(2)]);
  expect(
    await messagesFor(source, "src/user.test.ts", defineTestBehaviorCoverage({ maxInlineSnapshotLines: 20 })),
  ).toEqual([]);
});

it("stays silent on short, targeted snapshots and on a lone snapshot-only test", async () => {
  const targeted = `
it("totals", () => { expect(result.total).toMatchInlineSnapshot(\`30\`); });
it("labels", () => { expect(result.label).toMatchInlineSnapshot(\`"Thirty"\`); });`;
  const lone = `
it("renders", () => { expect(container).toMatchSnapshot(); });
it("counts", () => { expect(container.children).toHaveLength(2); });`;
  const backed = `
it("renders", () => { expect(container).toMatchSnapshot(); expect(container.textContent).toContain("Ada"); });
it("renders empty", () => { expect(container).toMatchSnapshot(); expect(container.children).toHaveLength(0); });`;
  expect(await messagesFor(targeted)).toEqual([]);
  expect(await messagesFor(lone)).toEqual([]);
  expect(await messagesFor(backed)).toEqual([]);
});

it("reports the interaction and the snapshot findings side by side", async () => {
  const source = `
it("notifies", () => { run(); expect(notify).toHaveBeenCalledWith("done"); });
it("logs", () => { run(); expect(log).toHaveBeenCalledTimes(1); });
it("renders", () => { expect(tree).toMatchSnapshot(); });
it("renders empty", () => { expect(output).toMatchInlineSnapshot(); });`;
  expect(await messagesFor(source)).toEqual([interactionOnlyMessage(2, 4, ["log", "notify"]), snapshotOnlyMessage(2)]);
});

it("mirrors options into the binding and validates them", () => {
  expect(testBehaviorCoverage.binding.options).toEqual({
    mockPattern: null,
    outcomePattern: null,
    minInteractionShare: null,
    maxInlineSnapshotLines: null,
  });
  expect(
    defineTestBehaviorCoverage({ mockPattern: /stub\(/g, minInteractionShare: 1, maxInlineSnapshotLines: 5 }).binding
      .options,
  ).toEqual({
    mockPattern: { source: "stub\\(", flags: "g" },
    outcomePattern: null,
    minInteractionShare: 1,
    maxInlineSnapshotLines: 5,
  });
  expect(() => defineTestBehaviorCoverage({ minInteractionShare: 0 })).toThrow("minInteractionShare");
  expect(() => defineTestBehaviorCoverage({ maxInlineSnapshotLines: 0 })).toThrow("maxInlineSnapshotLines");
});

it("points the judge at the testing skills", () => {
  expect(testBehaviorCoverage.standard.guidance).toMatchObject({
    refs: expect.arrayContaining([
      { type: "skill", id: "test-strategy" },
      { type: "skill", id: "testing" },
    ]),
  });
});
