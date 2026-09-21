import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineFakeParity, fakeParity } from "./rule.js";

const messageFor = (fake: string, port: string): string =>
  `Stateful fake \`${fake}\` encodes behaviour of \`${port}\` that nothing checks against the real implementation; run one shared suite or contract test against both, or cite the one that exists.`;

async function messages(source: string, file = "src/testing/fakes.ts", rule = fakeParity): Promise<readonly string[]> {
  return (await testRuleOnSource(rule, source, file)).map((finding) => finding.message);
}

const inMemoryRepository = `
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }

  async byId(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }
}`;

it("reports a fake class whose store is written by one method and read by another", async () => {
  expect(await messages(inMemoryRepository)).toEqual([messageFor("InMemoryOrderRepository", "OrderRepository")]);
  expect(await messages(inMemoryRepository, "src/orders.test.ts")).toHaveLength(1);
});

it("reports an object-literal fake closing over an array", async () => {
  const source = `
export function createFakePayments() {
  const charges: Charge[] = [];
  const gateway = {
    async charge(input: ChargeInput) {
      charges.push({ ...input, id: String(charges.length + 1) });
    },
    list: async () => charges.filter((charge) => !charge.refunded),
  } satisfies PaymentsGateway;
  return gateway;
}`;
  expect(await messages(source)).toEqual([messageFor("gateway", "PaymentsGateway")]);
});

it("reports an annotated object fake, generic port types and reassigned stores included", async () => {
  const source = `
let rows = [];
const store: DocumentStore<Invoice> = {
  items: {},
  put(doc) {
    this.items[doc.id] = doc;
  },
  get(id) {
    return this.items[id];
  },
};`;
  expect(await messages(source)).toEqual([messageFor("store", "DocumentStore")]);
});

it("stays silent on stubs that hold no state", async () => {
  expect(await messages("class FakeClock implements Clock { now() { return fixed; } }")).toEqual([]);
  expect(await messages("const gateway = { charge: async () => receipt } satisfies PaymentsGateway;")).toEqual([]);
});

it("stays silent when the store is only recorded or only read", async () => {
  const recorder = `
class FakeMailer implements Mailer {
  readonly sent: Mail[] = [];
  async send(mail: Mail) {
    this.sent.push(mail);
  }
  async sendAll(mails: Mail[]) {
    this.sent.push(...mails);
  }
}`;
  const lookup = `
class StubCatalog implements Catalog {
  private readonly products = new Map(seed);
  byId(id: string) {
    return this.products.get(id);
  }
  all() {
    return [...this.products.values()];
  }
}`;
  const sameMethod = `
class FakeCounter implements Counter {
  private seen: string[] = [];
  next(id: string) {
    this.seen.push(id);
    return this.seen.length;
  }
  reset() {}
}`;
  expect(await messages(recorder)).toEqual([]);
  expect(await messages(lookup)).toEqual([]);
  expect(await messages(sameMethod)).toEqual([]);
});

it("stays silent on a stateful class that implements no port", async () => {
  expect(await messages(inMemoryRepository.replace(" implements OrderRepository", ""))).toEqual([]);
  expect(await messages(inMemoryRepository.replace("InMemoryOrderRepository", "SqlOrderRepository"))).toEqual([]);
});

it("stays silent on a stateful object that is not typed as a port", async () => {
  const source = `
const values = new Map();
const settings: Settings = {
  set(key, value) {
    values.set(key, value);
  },
  get(key) {
    return values.get(key);
  },
};`;
  expect(await messages(source)).toEqual([]);
  expect(await messages(source.replace(": Settings", ": SettingsStore"))).toEqual([
    messageFor("settings", "SettingsStore"),
  ]);
});

it("accepts custom patterns and mirrors them into the binding", async () => {
  const rule = defineFakeParity({ fakeNamePattern: /^Mock[A-Z]/, portTypePattern: /Adapter$/ });
  const source = inMemoryRepository.replace("InMemoryOrderRepository", "MockOrderRepository");
  expect(await messages(source, "src/fakes.ts", rule)).toEqual([messageFor("MockOrderRepository", "OrderRepository")]);
  expect(await messages(source)).toEqual([]);
  expect(rule.binding.options).toEqual({
    fakeNamePattern: { source: "^Mock[A-Z]", flags: "" },
    portTypePattern: { source: "Adapter$", flags: "" },
  });
  expect(fakeParity.binding.options).toEqual({ fakeNamePattern: null, portTypePattern: null });
  expect(fakeParity.binding.exclude).toEqual(["**/*.d.ts"]);
});
