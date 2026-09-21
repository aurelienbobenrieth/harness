import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { abstractionEarnsKeep, defineAbstractionEarnsKeep } from "./rule.js";

const namedInterfaceMessage =
  "Exported interface uses premature-abstraction naming; it earns its keep with a second implementation or a real seam.";
const delegationMessage =
  "Exported function only delegates to a single call; inline the wrapper or give it real logic.";
const headerMessage = (name: string, implementer: string): string =>
  `Interface \`${name}\` lists exactly the members of its only implementer \`${implementer}\` in this file; it earns its keep with a second implementer, a test double, or a consumer-owned seam.`;
const affixMessage = (implementer: string, name: string): string =>
  `Class \`${implementer}\` is named as the implementation of \`${name}\` from a sibling module; the interface earns its keep with a second implementer, a test double, or a consumer-owned seam.`;
const forwardingClassMessage = (name: string, forwarding: number, members: number, field: string): string =>
  `Class \`${name}\` forwards ${forwarding} of ${members} methods unchanged to \`this.${field}\`; state what this layer decides, or let callers take the collaborator directly.`;
const forwardingModuleMessage = (forwarding: number, members: number, binding: string): string =>
  `Module forwards ${forwarding} of ${members} exported functions unchanged to \`${binding}\`; state what this layer decides, or let callers import the collaborator directly.`;

async function messages(source: string, rule = abstractionEarnsKeep): Promise<readonly string[]> {
  return (await testRuleOnSource(rule, source, "src/invoice-service.ts")).map((finding) => finding.message);
}

const headerInterface = `
export interface InvoiceService {
  issue(draft: Draft): Promise<Invoice>;
  cancel: (id: string) => Promise<void>;
}

export class InvoiceServiceImpl implements InvoiceService {
  constructor(private readonly ledger: Ledger) {}
  async issue(draft: Draft) {
    const entries = toEntries(draft);
    return this.ledger.post(entries);
  }
  cancel = async (id: string) => {
    await this.ledger.reverse(id, new Date());
  };
  private audit() {}
  static create() {}
}`;

it("reports an interface that mirrors its only implementer in the file", async () => {
  expect(await messages(headerInterface)).toEqual([headerMessage("InvoiceService", "InvoiceServiceImpl")]);
});

it("reports header types implemented by a single object literal", async () => {
  const satisfied = `
type Clock = { now(): Date };
export const systemClock = { now: () => new Date() } satisfies Clock;`;
  const annotated = `
interface Clock { now(): Date }
export const systemClock: Clock = { now() { return new Date(); } };`;
  expect(await messages(satisfied)).toEqual([headerMessage("Clock", "systemClock")]);
  expect(await messages(annotated)).toEqual([headerMessage("Clock", "systemClock")]);
});

it("stays silent once the file shows a second implementer", async () => {
  const source = `${headerInterface}
export class InMemoryInvoiceService implements InvoiceService {
  async issue(draft: Draft) { return fromDraft(draft); }
  cancel = async () => {};
}`;
  expect(await messages(source)).toEqual([]);
});

it("stays silent when the interface is narrower than its implementer", async () => {
  const source = headerInterface.replace("private audit() {}", "audit() {}");
  expect(await messages(source)).toEqual([]);
});

it("stays silent on data shapes with a single typed literal", async () => {
  const source = `
export interface RetryPolicy { attempts: number; backoffMs: number }
export const defaults: RetryPolicy = { attempts: 3, backoffMs: 200 };
export interface Unused { run(): void }`;
  expect(await messages(source)).toEqual([]);
});

it("no longer reports interfaces on their name alone", async () => {
  expect(await messages("export interface IUser {id:string}")).toEqual([]);
  expect(await messages("export interface IPAddress { octets: number[]; toString(): string }")).toEqual([]);
  expect(await messages("export interface StoreInterface {\n  read(): string;\n}")).toEqual([]);
});

it("restores the naming trigger when a pattern is passed, unless two implementers show", async () => {
  const rule = defineAbstractionEarnsKeep({ interfacePattern: /^I[A-Z][a-z]|Interface$/g });
  expect(await messages("export interface IUserService {\n  getUser(id: string): string;\n}", rule)).toEqual([
    namedInterfaceMessage,
  ]);
  expect(await messages("export interface IUserService {\n  getUser(id: string): string;\n}", rule)).toEqual([
    namedInterfaceMessage,
  ]);
  expect(await messages("export interface StoreInterface { read(): string }", rule)).toEqual([namedInterfaceMessage]);
  expect(await messages("export interface IPAddress { toString(): string }", rule)).toEqual([]);
  expect(await messages("export interface UserRecord { id: string }", rule)).toEqual([]);
  expect(await messages("interface IUserService { getUser(id: string): string }", rule)).toEqual([]);

  const twoImplementers = `
export interface IMailer { send(mail: Mail): void }
class SmtpMailer implements IMailer { send(mail: Mail) { smtp(mail); } }
class QueueMailer implements IMailer { send(mail: Mail) { enqueue(mail); } }`;
  expect(await messages(twoImplementers, rule)).toEqual([]);
});

it("reports the header finding once when the naming pattern also matches", async () => {
  const rule = defineAbstractionEarnsKeep({ interfacePattern: /^I[A-Z][a-z]/ });
  const source = `
export interface IMailer { send(mail: Mail): void }
class SmtpMailer implements IMailer { send(mail: Mail) { smtp(mail); } }`;
  expect(await messages(source, rule)).toEqual([headerMessage("IMailer", "SmtpMailer")]);
});

const siblingImplementation = (className: string, imported = "OrderService", local = imported): string => `
import type { ${imported === local ? imported : `${imported} as ${local}`} } from "./order-service";
export class ${className} implements ${local} {
  place(order: Order) { return this.pricing.total(order) > 0; }
}`;

it("reports a class named as the implementation of a sibling-module interface", async () => {
  expect(await messages(siblingImplementation("OrderServiceImpl"))).toEqual([
    affixMessage("OrderServiceImpl", "OrderService"),
  ]);
  expect(await messages(siblingImplementation("DefaultOrderService"))).toEqual([
    affixMessage("DefaultOrderService", "OrderService"),
  ]);
  expect(await messages(siblingImplementation("OrderService", "IOrderService"))).toEqual([
    affixMessage("OrderService", "IOrderService"),
  ]);
  expect(await messages(siblingImplementation("OrderServiceImpl", "Orders", "OrderService"))).toEqual([
    affixMessage("OrderServiceImpl", "OrderService"),
  ]);
});

it("stays silent on implementations with their own name or a package-owned interface", async () => {
  const ownName = `
import type { OrderService } from "./order-service";
export class PostgresOrderService implements OrderService { place(order: Order) { return insert(order); } }`;
  const packageOwned = `
import type { OrderService } from "@acme/orders";
export class OrderServiceImpl implements OrderService { place(order: Order) { return insert(order); } }`;
  expect(await messages(ownName)).toEqual([]);
  expect(await messages(packageOwned)).toEqual([]);
});

const forwardingClass = `
export class OrderService {
  constructor(private readonly repo: OrderRepository) {}
  find(id: string) {
    return this.repo.find(id);
  }
  async save(order: Order, options: SaveOptions) {
    return await this.repo.save(order, options);
  }
  remove = (id: string) => this.repo.remove(id);
}`;

it("reports a class whose methods forward unchanged to one field", async () => {
  expect(await messages(forwardingClass)).toEqual([forwardingClassMessage("OrderService", 3, 3, "repo")]);
});

it("stays silent on a facade that reorders, defaults or reshapes arguments", async () => {
  const source = `
export class OrderFacade {
  constructor(private readonly repo: OrderRepository) {}
  find(tenant: string, id: string) {
    return this.repo.find(id, tenant);
  }
  save(order: Order, options: SaveOptions = {}) {
    return this.repo.save(order, options);
  }
  remove(id: string) {
    return this.repo.remove({ id });
  }
}`;
  expect(await messages(source)).toEqual([]);
});

it("stays silent when forwarding is the minority or spread over collaborators", async () => {
  const minority = `
export class OrderService {
  find(id: string) { return this.repo.find(id); }
  list(page: Page) { return this.repo.list(page); }
  place(order: Order) { this.policy.check(order); return this.repo.save(price(order)); }
  cancel(id: string) { return this.repo.save(cancel(this.repo.find(id))); }
  refund(id: string) { return this.payments.refund(this.repo.find(id).paymentId); }
}`;
  const decorator = `
export class CachedCatalog {
  byId(id: string) { return this.cache.get(id) ?? this.inner.byId(id); }
  search(query: Query) { return this.inner.search(query); }
  all() { return this.inner.all(); }
  count() { return this.inner.count(); }
}`;
  const spread = `
export class Backoffice {
  orders(page: Page) { return this.orderRepo.list(page); }
  users(page: Page) { return this.userRepo.list(page); }
  invoices(page: Page) { return this.invoiceRepo.list(page); }
}`;
  const small = `
export class Pair {
  find(id: string) { return this.repo.find(id); }
  save(order: Order) { return this.repo.save(order); }
}`;
  expect(await messages(minority)).toEqual([]);
  expect(await messages(decorator)).toEqual([]);
  expect(await messages(spread)).toEqual([]);
  expect(await messages(small)).toEqual([]);
  expect(await messages(decorator, defineAbstractionEarnsKeep({ forwardingRatio: 0.75 }))).toEqual([
    forwardingClassMessage("CachedCatalog", 3, 4, "inner"),
  ]);
  expect(await messages(small, defineAbstractionEarnsKeep({ minForwardingMembers: 2 }))).toEqual([
    forwardingClassMessage("Pair", 2, 2, "repo"),
  ]);
});

const forwardingModule = `
import { client } from "./client";

export function getUser(id: string) {
  return client.getUser(id);
}
export const listUsers = (page: number) => {
  return client.listUsers(page);
};
export const removeUser = (id: string) => client.removeUser(id);`;

it("reports a forwarding module once and folds its per-export findings into it", async () => {
  expect(await messages(forwardingModule)).toEqual([forwardingModuleMessage(3, 3, "client")]);
});

it("keeps the per-export finding for delegations the module finding does not cover", async () => {
  const source = `${forwardingModule}
export const countUsers = () => client.countUsers();
export function getTeam(id: string) {
  return directory.getTeam(id);
}`;
  expect(await messages(source)).toEqual([forwardingModuleMessage(4, 5, "client"), delegationMessage]);
  expect(await messages(source.replace("export const countUsers = () => client.countUsers();", ""))).toEqual([
    delegationMessage,
    delegationMessage,
    delegationMessage,
  ]);
});

it("reports lone exported functions that only delegate to a single call", async () => {
  expect(await messages("export function getUser(id: string) {\n  return repo.getUser(id);\n}")).toEqual([
    delegationMessage,
  ]);
  expect(await messages("export const listUsers = (page: number) => {\n  return client.listUsers(page);\n};")).toEqual([
    delegationMessage,
  ]);
});

it("stays silent on modules whose exports forward to local or mixed collaborators", async () => {
  const source = `
import { client } from "./client";
const cache = createCache();
export const getUser = (id: string) => cache.getUser(id);
export const listUsers = (page: number) => cache.listUsers(page);
export const removeUser = (id: string) => client.removeUser(normalize(id));`;
  expect(await messages(source)).toEqual([]);
});

it("ignores exported functions with more than a delegation", async () => {
  expect(
    await messages(
      "export function getUser(id: string) {\n  const normalized = id.trim();\n  return repo.getUser(normalized);\n}",
    ),
  ).toEqual([]);
});

it("mirrors options into the binding and validates thresholds", () => {
  expect(abstractionEarnsKeep.binding.options).toEqual({
    interfacePattern: null,
    minForwardingMembers: null,
    forwardingRatio: null,
  });
  expect(
    defineAbstractionEarnsKeep({ interfacePattern: /^I[A-Z][a-z]/, minForwardingMembers: 4, forwardingRatio: 1 })
      .binding.options,
  ).toEqual({
    interfacePattern: { source: "^I[A-Z][a-z]", flags: "" },
    minForwardingMembers: 4,
    forwardingRatio: 1,
  });
  expect(() => defineAbstractionEarnsKeep({ forwardingRatio: 1.5 })).toThrow("forwardingRatio");
  expect(() => defineAbstractionEarnsKeep({ minForwardingMembers: 0 })).toThrow("minForwardingMembers");
});
