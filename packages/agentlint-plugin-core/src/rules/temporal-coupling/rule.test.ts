import { testRuleOnSource } from "@aurelienbbn/agentlint/testing";
import { expect, it } from "vitest";
import { defineTemporalCoupling, temporalCoupling } from "./rule.js";

async function signals(source: string, rule = temporalCoupling, file = "src/module.ts") {
  return (await testRuleOnSource(rule, source, file)).map((finding) =>
    finding.message.replace(/^Class (?:`(\w+)` )?can be held before it is usable \(([^)]*)\).*$/, "$1:$2"),
  );
}

const indexer = `
export class Indexer {
  private db!: Database;
  async init() {
    this.db = await openDatabase();
  }
  search(term: string) {
    return this.db.query(term);
  }
}`;

it("reports a definite-assignment field filled by a method, on the class name", async () => {
  const findings = await testRuleOnSource(temporalCoupling, indexer, "src/indexer.ts");
  expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
    [
      2,
      "Class `Indexer` can be held before it is usable (definite-assignment); finish construction in a factory that returns a ready instance, or model the unready state as its own type.",
    ],
  ]);
});

it("reports a guard that confesses the call order, in declarations and class expressions", async () => {
  expect(
    await signals(
      'class Client { send(message: string) { if (!this.socket) throw new Error("Client not connected"); } }',
    ),
  ).toEqual(["Client:guard-throw"]);
  expect(
    await signals("const Store = class { read() { if (!this.ready) throw new StateError(`call open() first`); } };"),
  ).toEqual([":guard-throw"]);
  expect(
    await signals('abstract class Base { run() { throw new Error("Runner has not been initialized"); } }'),
  ).toEqual(["Base:guard-throw"]);
});

const client = (secondCheck: string): string => `
class Client {
  #socket: Socket | null = null;
  async connect() { this.#socket = await dial(); }
  send(message: string) { if (!this.#socket) return; this.#socket.write(message); }
  ping() { ${secondCheck} }
  close() { this.#socket = null; }
}`;

it("reports a nullable field filled by an init-style method and null-checked in two other methods", async () => {
  expect(await signals(client("return this.#socket?.ping();"))).toEqual(["Client:nullable-init"]);
  expect(await signals(client("if (this.#socket === null) return; this.#socket.ping();"))).toEqual([
    "Client:nullable-init",
  ]);
  expect(await signals(client("return this.id;"))).toEqual([]);
});

it("yields one finding for a class showing several signals", async () => {
  const source = `
class Indexer {
  private db!: Database;
  async init() { this.db = await openDatabase(); }
  search(term: string) {
    if (!this.db) throw new Error("Indexer not initialized");
    return this.db.query(term);
  }
}`;
  expect(await signals(source)).toEqual(["Indexer:definite-assignment, guard-throw"]);
});

it("stays silent on constructor-complete classes and static factories", async () => {
  expect(
    await signals(
      "class Indexer { private readonly db: Database; constructor(db: Database) { this.db = db; } search() { return this.db; } }",
    ),
  ).toEqual([]);
  expect(
    await signals(
      "class Indexer { private constructor(private readonly db: Database) {} static async open() { return new Indexer(await openDatabase()); } }",
    ),
  ).toEqual([]);
});

it("stays silent on decorated framework fields, constructor-assigned `!` fields and ordinary errors", async () => {
  expect(
    await signals(
      "class Card extends LitElement { @property() name!: string; update() { this.name = this.name.trim(); } }",
    ),
  ).toEqual([]);
  expect(
    await signals(
      "class Indexer { private db!: Database; constructor(db: Database) { this.db = db; } swap(db: Database) { this.db = db; } }",
    ),
  ).toEqual([]);
  expect(await signals("class Indexer { private db!: Database; search() { return this.db; } }")).toEqual([]);
  expect(await signals('class Users { find(id: string) { throw new Error("User not found"); } }')).toEqual([]);
  expect(
    await signals(
      "class Cache { private value: string | null = null; remember(next: string) { this.value = next; } a() { return this.value?.length; } b() { if (!this.value) return 0; return 1; } }",
    ),
  ).toEqual([]);
});

it("attributes signals to the class that owns them", async () => {
  const source = `
class Outer {
  build() {
    return class Inner { run() { throw new Error("not initialized"); } };
  }
}`;
  expect(await signals(source)).toEqual(["Inner:guard-throw"]);
});

it("keeps test files out of the binding", () => {
  expect(temporalCoupling.binding.exclude).toEqual(["**/*.d.ts", "**/*.{test,spec}.*", "**/__tests__/**"]);
});

it("honours custom patterns and mirrors them into the binding", async () => {
  const rule = defineTemporalCoupling({ guardMessagePattern: /warm up first/gi, initMethodPattern: /^warmUp$/g });
  const guard = 'class Engine { run() { throw new Error("Warm up first"); } }';
  expect(await signals(guard, rule)).toEqual(["Engine:guard-throw"]);
  expect(await signals(guard, rule)).toEqual(["Engine:guard-throw"]);
  expect(await signals(guard)).toEqual([]);
  const nullable =
    "class Engine { oil: Oil | undefined; warmUp() { this.oil = heat(); } a() { return this.oil?.level; } b() { if (!this.oil) return; } }";
  expect(await signals(nullable, rule)).toEqual(["Engine:nullable-init"]);
  expect(await signals(nullable)).toEqual([]);
  expect(rule.binding.options).toEqual({
    guardMessagePattern: { source: "warm up first", flags: "gi" },
    initMethodPattern: { source: "^warmUp$", flags: "g" },
  });
});
