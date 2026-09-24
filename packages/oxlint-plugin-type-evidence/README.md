# @aurelienbbn/oxlint-plugin-type-evidence

**10 oxlint rules that stop TypeScript from losing what it knows: no laundering casts, no `unknown` leaking past boundaries, no widening a value you just wrote.**

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-type-evidence oxlint   # oxlint >=1.82.0 <2.0.0
```

```ts
// oxlint.config.ts
import { strictRules } from "@aurelienbbn/oxlint-plugin-type-evidence";
import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: ["@aurelienbbn/oxlint-plugin-type-evidence"],
  rules: { ...strictRules }, // all 10 at "error"
});
```

Exports: `default` (the plugin, `type-evidence/*`), `strictRules` (every rule at `"error"`).

**Report-only, 0 autofix:** restoring evidence (named contract, parser, inference) is a choice no tool makes.

## ❌ vs ✅

| Rule                                        | ❌ Fires                                                      | ✅ Passes                                            |
| ------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| `no-chained-type-assertions`                | `input as unknown as User`                                    | `[1, 2] as const` (all-`as const` chains)            |
| `no-object-parameters`                      | `function handle(payload: object)`                            | `function handle<T extends object>(payload: T)`      |
| `no-unknown-parameters`                     | `function parse(value: unknown)`                              | `function isUser(value: unknown): value is User`     |
| `no-unknown-returns`                        | `async function load(): Promise<unknown>`                     | `function load() { return compute(); }`              |
| `no-unknown-type-aliases`                   | `type Data = unknown`                                         | `type Payload = Box<unknown>`                        |
| `no-unsafe-dictionary-type`                 | `type Dict = Record<string, unknown>`                         | `type Events = Record<string, { payload: unknown }>` |
| `no-known-value-widening`                   | `const state: unknown = { status: "idle" }`                   | `const acc: Record<string, number> = {}`             |
| `no-widen-then-assert`                      | `const data: unknown = { id: 1 }; const user = data as User;` | assert a precisely typed binding                     |
| `require-safety-comment-for-type-assertion` | `const user = input as User;`                                 | `// SAFETY: input validated upstream` above it       |
| `no-runtime-typeof`                         | `const kind = typeof value`                                   | `typeof window !== "undefined"`                      |

<details>
<summary>Exact scope per rule</summary>

| Rule                                        | Also fires on                                                                                                                                                                              | Stays valid                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-chained-type-assertions`                | any chain of ≥ 2 assertions: it launders through `unknown` / `any`                                                                                                                         | chains made only of `as const`                                                                                                              |
| `no-object-parameters`                      | `object` reached through a same-file alias or a union member                                                                                                                               | generic constraints (`T extends object`)                                                                                                    |
| `no-unknown-parameters`                     | —                                                                                                                                                                                          | a parameter named `cause`; the subject of a type predicate (`value is T` / `asserts value`)                                                 |
| `no-unknown-returns`                        | `unknown` directly, in a union, in `Promise<unknown>` / `PromiseLike<unknown>`, via a same-file alias                                                                                      | omitted annotation; `unknown` nested in a named object shape (`{ cause: unknown }`)                                                         |
| `no-unknown-type-aliases`                   | `unknown` through parens, a union, or transitive same-file aliases                                                                                                                         | `unknown` nested in a generic argument                                                                                                      |
| `no-unsafe-dictionary-type`                 | broad keys (`string`, `number`, `symbol`, `PropertyKey`, or unions containing one) × contract-free values (`unknown`, `any`, `object`, `{}`), as `Record`, index signature, or mapped type | finite-key records, exhaustive mapped types, nested `unknown` inside a value shape, `Map` / `WeakMap`, type-parameter constraints           |
| `no-known-value-widening`                   | a literal, object, array, function, class, `new`, or template flowing into `unknown`, `object`, broad `Record`, an index-signature literal, or an anonymous type literal                   | the empty-object accumulator `const acc: Record<string, number> = {}`. ⚠️ `{}` into `unknown` / `object` still reports                      |
| `no-widen-then-assert`                      | a `const` declared broad over a known initializer, re-narrowed later in the same function with an assertion                                                                                | reassigned `let` bindings                                                                                                                   |
| `require-safety-comment-for-type-assertion` | every assertion except `as const` without a marker on or before its owning statement                                                                                                       | —                                                                                                                                           |
| `no-runtime-typeof`                         | `typeof` anywhere else: it rebuilds type evidence at runtime and only reaches primitive buckets                                                                                            | existence probes; with `allowInTypeGuards`: any function returning a type predicate, and `typeof` on the function's own `unknown` parameter |

</details>

<details>
<summary>Options</summary>

| Rule                                        | Option              | Default                                                              |
| ------------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| `require-safety-comment-for-type-assertion` | `markers`           | `["SAFETY"]` (replaced, not merged)                                  |
| `no-runtime-typeof`                         | `allowInTypeGuards` | `true` (unlike the source concept); `false` deliberately tightens it |

</details>

**A safety comment needs ≥ 3 real words**, not a placeholder (`todo`, `fixme`, `trust me`, `this is safe`); trailing same-line comments and empty markers don't count. **It never proves the cast safe:** the invariant still needs human review.

## Boundaries are exempt

```text
**/boundaries/**   **/decoders/**   **/adapters/**   *.boundary.{ts,tsx,js,jsx,mts,cts,mjs,cjs}
        ▲
        └── unknown input is legitimate here: no-unknown-parameters, no-unknown-returns,
            no-unknown-type-aliases, no-unsafe-dictionary-type, no-runtime-typeof stay silent
```

## Single-file and syntactic

No type checker, no cross-file resolution.

<details>
<summary>Limits</summary>

| Limit             | Detail                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| alias resolution  | same-file, non-generic aliases only                                                                                                                                                    |
| binding tracking  | `no-known-value-widening` and `no-widen-then-assert` resolve bindings through lexical scope: captured bindings are tracked across function boundaries, shadowed bindings stay separate |
| alias consumers   | `no-unsafe-dictionary-type` reports an unsafe alias at its declaration; its consumers aren't re-reported                                                                               |
| overloads         | `TSDeclareFunction` overload signatures aren't visited by the parameter/return rules                                                                                                   |
| policy, not proof | populated structural contracts aren't automatically evidence loss. Preferring internal discriminated unions over `typeof` is architecture policy, not proof `typeof` is unsafe         |
| recursion         | recursive type traversal terminates normally                                                                                                                                           |

</details>

**Credit:** all 10 rules re-implement concepts from [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) (Dillon Mulroy, MIT) in this repo's own style; no code copied.

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                                  | Trigger or review scope                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `no-chained-type-assertions`                | Disallow chains of type assertions that launder a value through unknown or any.          |
| `no-known-value-widening`                   | Disallow flowing syntactically known values into explicitly broad type annotations.      |
| `no-object-parameters`                      | Disallow parameter annotations that resolve to the shapeless object keyword.             |
| `no-runtime-typeof`                         | Disallow runtime typeof checks outside existence probes and type guard functions.        |
| `no-unknown-parameters`                     | Disallow unknown in parameter annotations outside type guards and error causes.          |
| `no-unknown-returns`                        | Disallow unknown in return type annotations, including inside Promise results.           |
| `no-unknown-type-aliases`                   | Disallow type aliases that resolve to unknown.                                           |
| `no-unsafe-dictionary-type`                 | Disallow dictionary types whose broad keys map to contract-free values.                  |
| `no-widen-then-assert`                      | Disallow widening a known const initializer and re-narrowing it later with an assertion. |
| `require-safety-comment-for-type-assertion` | Require every non-const type assertion to carry a marker comment justifying its safety.  |

### Credited concepts

- anti-slop by Dillon Mulroy (MIT, concept re-implemented)

<!-- harness-catalog:end -->
