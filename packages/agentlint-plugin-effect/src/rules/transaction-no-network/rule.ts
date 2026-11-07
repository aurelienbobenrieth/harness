import { defineRule, type StateRule } from "@aurelienbbn/agentlint";
import { mayOpenTransaction, transactionCallsOf, type TransactionCall } from "./openers.js";
import { diskRepo, memoryRepo, parseTree, programOf, rootOf, type Program } from "./program.js";
import { digestOf, reachNetwork, type Sink } from "./reach.js";

export type TransactionNoNetworkOptions = {
  /** Extra names called with a transaction's work as the first argument (`atomically`): `atomically(work)`. */
  readonly openers?: readonly string[];
  /** Extra names called as `name(scope)(work)`, for openers that take a scope first (`inTenant`). */
  readonly curriedOpeners?: readonly string[];
  /** Import specifiers (`@acme/mailer`) or repository path prefixes (`src/clients`) that talk to the network. */
  readonly networkModules?: readonly string[];
  /** Service or function names that talk to the network, for what the rule cannot infer from their layers. */
  readonly networkServices?: readonly string[];
};

interface Violation {
  readonly transaction: TransactionCall;
  readonly sinks: readonly Sink[];
  readonly row: number;
  readonly column: number;
  readonly length: number;
}

const describeSink = (sink: Sink): string => {
  const names = sink.path.map((step) => step.name);
  const via = names.length === 0 ? "" : `${names.join(" → ")} → `;
  switch (sink.kind) {
    case "fetch":
      return `${via}global fetch`;
    case "http-client":
      return `${via}an HTTP client (${sink.what})`;
    case "service":
      return `${via}${sink.what}, a configured network service`;
    default:
      return `${via}${sink.what}`;
  }
};

const positionOf = (text: string, offset: number): { row: number; column: number } => {
  let row = 0;
  let lineStart = 0;
  for (let index = text.indexOf("\n"); index !== -1 && index < offset; index = text.indexOf("\n", index + 1)) {
    row += 1;
    lineStart = index + 1;
  }
  return { column: offset - lineStart, row };
};

export function defineTransactionNoNetwork(options: TransactionNoNetworkOptions = {}): StateRule {
  options = structuredClone(options);
  const names = { curried: options.curriedOpeners ?? [], direct: options.openers ?? [] };
  const sinks = { modules: options.networkModules ?? [], services: options.networkServices ?? [] };

  return defineRule({
    lifecycle: "state",
    standard: {
      id: "effect/transaction-no-network",
      revision: 1,
      title: "Transactions never wait on the network",
      summary:
        "Flags a database transaction whose work reaches a network call (fetch, an HTTP client, a service whose layer calls one) so the call moves before it opens or after it commits.",
      guidance: {
        standard:
          "Code running inside a database transaction never calls the network. A slow or failing provider then holds row locks and a pooled connection for as long as it takes to answer, and a retried or rolled-back transaction repeats a side effect it cannot undo. Read what the transaction needs, commit, call, and record the outcome in a second transaction; or write the intent inside the transaction and send from a job after the commit.",
        checks: [
          "Follow the path the message names: the transaction's work reaches the call through those declarations.",
          "Fails when the call can run inside the transaction. Move it before the transaction opens or after it commits, or record the intent in the transaction and send it from a job.",
          "Passes when the path cannot run inside the transaction (a branch the transaction never takes, a callback only invoked after commit). Name why.",
          "Writing an outbox row, enqueueing a job to run after commit, or reading and writing the database inside the transaction is not a network call.",
        ],
        examples: [
          {
            label: "FAIL",
            description: "The email is sent while the transaction holds its locks.",
            code: "yield* sql.withTransaction(\n  Effect.gen(function* () {\n    yield* orders.save(order);\n    yield* Mailer.use((mailer) => mailer.send(receipt(order)));\n  }),\n);",
          },
          {
            label: "PASS",
            description: "Commit first, then send; a failed send never holds a lock.",
            code: "yield* sql.withTransaction(orders.save(order));\nyield* Mailer.use((mailer) => mailer.send(receipt(order)));",
          },
        ],
        refs: [
          { type: "url", href: "https://www.postgresql.org/docs/current/explicit-locking.html" },
          { type: "url", href: "https://microservices.io/patterns/data/transactional-outbox.html" },
        ],
      },
    },
    binding: {
      id: "effect/transaction-no-network",
      authority: "agent",
      include: ["**/*.{ts,tsx,mts,cts}"],
      exclude: [
        "**/*.d.ts",
        "**/*.{test,spec}.{ts,tsx}",
        "**/{test,tests,__tests__,testing,fixtures}/**",
        "**/testing.{ts,tsx}",
      ],
      options: {
        curriedOpeners: [...names.curried],
        networkModules: [...sinks.modules],
        networkServices: [...sinks.services],
        openers: [...names.direct],
      },
    },
    detector: {
      id: "effect/transaction-no-network",
      version: 1,
      scan: "file",
      fixtures: {
        mustReport: [
          {
            label: "a fetch inside sql.withTransaction",
            files: {
              "src/orders/place.ts":
                'export const place = (sql) => sql.withTransaction(fetch("https://example.com/hooks"));\n',
            },
          },
          {
            label: "a send reached through a helper in another file, a service whose layer calls fetch",
            files: {
              "src/mail/service.ts":
                'import * as Context from "effect/Context";\nexport class Mailer extends Context.Service<Mailer, { send: () => void }>()("Mailer") {}\n',
              "src/mail/resend.ts":
                'import * as Layer from "effect/Layer";\nimport { Mailer } from "./service.js";\nexport const MailerLive = Layer.succeed(Mailer, { send: () => fetch("https://api.resend.com/emails") });\n',
              "src/orders/notify.ts":
                'import { Mailer } from "../mail/service.js";\nexport const notify = () => Mailer.use((mailer) => mailer.send());\n',
              "src/orders/place.ts":
                'import { notify } from "./notify.js";\nexport const place = (db) => db.transaction(async (tx) => { await tx.insert(); await notify(); });\n',
            },
          },
        ],
        mustStaySilent: [
          {
            label: "the send after the transaction commits, and an outbox write inside",
            files: {
              "src/orders/place.ts": [
                "export const place = (sql, outbox) =>",
                "  sql.withTransaction(outbox.add(order)).pipe(() => fetch(url));",
                "",
              ].join("\n"),
            },
          },
          {
            label: "a service whose only layer is in memory",
            files: {
              "src/mail/service.ts":
                'import * as Context from "effect/Context";\nexport class Mailer extends Context.Service<Mailer, { send: () => void }>()("Mailer") {}\n',
              "src/mail/memory.ts":
                'import * as Layer from "effect/Layer";\nimport { Mailer } from "./service.js";\nexport const MailerMemory = Layer.succeed(Mailer, { send: () => undefined });\n',
              "src/orders/place.ts":
                'import { Mailer } from "../mail/service.js";\nexport const place = (sql) => sql.withTransaction(Mailer.use((mailer) => mailer.send()));\n',
            },
          },
        ],
      },
      createOnce({ context }) {
        const state: {
          program: Program | undefined;
          memory: Record<string, string>;
          violations: readonly Violation[];
        } = {
          memory: {},
          program: undefined,
          violations: [],
        };
        const programFor = (): Program => {
          const root = rootOf(context.path, context.absolutePath);
          if (root !== undefined) {
            state.program ??= programOf(diskRepo(root));
          } else {
            state.program = programOf(memoryRepo({ ...state.memory }));
          }
          return state.program;
        };

        return {
          before(): boolean {
            const root = rootOf(context.path, context.absolutePath);
            if (root === undefined) state.memory[context.path] = context.source;
            state.violations = [];
            if (!mayOpenTransaction(context.source, names)) return false;
            const program = programFor();
            const tree = parseTree(context.path, context.source);
            state.violations = transactionCallsOf(tree, names).flatMap((transaction) => {
              const reached = reachNetwork({
                file: context.path,
                program,
                sinks,
                start: transaction.inside,
              });
              if (reached.length === 0) return [];
              const { column, row } = positionOf(context.source, transaction.call.start);
              return [
                {
                  column,
                  length: transaction.call.end - transaction.call.start,
                  row,
                  sinks: reached,
                  transaction,
                },
              ];
            });
            return state.violations.length > 0;
          },
          call_expression(node) {
            for (const violation of state.violations) {
              if (
                node.startPosition.row !== violation.row ||
                node.startPosition.column !== violation.column ||
                node.text.length !== violation.length
              ) {
                continue;
              }
              const program = programFor();
              context.report({
                evidence: {
                  opener: violation.transaction.opener,
                  sinks: violation.sinks.map((sink) => ({
                    kind: sink.kind,
                    path: sink.path.map((step) => ({
                      digest: digestOf(program, step),
                      file: step.file,
                      name: step.name,
                    })),
                    what: sink.what,
                  })),
                },
                message: `This transaction (${violation.transaction.opener}) waits on the network: ${violation.sinks.map(describeSink).join("; ")}. Make the call before the transaction opens or after it commits.`,
                node,
              });
            }
          },
        };
      },
    },
  });
}

/** The rule with built-in openers (`withTransaction`, `transaction(fn)`, `$transaction(fn)`) and inferred network sinks. */
export const transactionNoNetwork = defineTransactionNoNetwork();
