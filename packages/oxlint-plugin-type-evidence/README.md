# @aurelienbbn/oxlint-plugin-type-evidence

Strict oxlint rules preserving TypeScript type evidence at contracts and boundaries. Every rule is report-only: fixing a violation means restoring real evidence (a named contract, a parser, inference), which no autofix can choose for you.

## Preset

The package default-exports the plugin and exports `strictRules`, a record that turns every rule on as `"error"`.

```jsonc
// oxlint.json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-type-evidence"],
  "rules": { "type-evidence/no-chained-type-assertions": "error" /* ... */ },
}
```

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

### `type-evidence/no-chained-type-assertions`

Chains of two or more assertions launder a value through `unknown` or `any` and destroy the original evidence. Chains made only of `as const` stay valid.

```ts
const user = input as unknown as User; // violation
const pair = [1, 2] as const; // valid
```

### `type-evidence/no-object-parameters`

The `object` keyword accepts almost anything and offers no shape, including when reached through a same-file alias or a union member. Generic constraints (`T extends object`) stay valid.

```ts
function handle(payload: object) {} // violation
function handle<T extends object>(payload: T) {} // valid
```

### `type-evidence/no-unknown-parameters`

`unknown` parameters push parsing duty onto every caller. Exceptions: a parameter named `cause`, and the subject of a type predicate (`value is T` / `asserts value`).

```ts
function parse(value: unknown) {} // violation
function isUser(value: unknown): value is User {} // valid
```

### `type-evidence/no-unknown-returns`

Returning `unknown` (directly, in a union, through `Promise<unknown>` / `PromiseLike<unknown>`, or via a same-file alias) erases what the function produces. Omitting the annotation and `unknown` nested inside a named object shape (`{ cause: unknown }`) stay valid.

```ts
async function load(): Promise<unknown> {} // violation
function load() {
  return compute();
} // valid
```

### `type-evidence/no-unknown-type-aliases`

An alias that resolves to `unknown` (directly, through parens, a union, or transitive same-file aliases) names the absence of evidence.

```ts
type Data = unknown; // violation
type Payload = Box<unknown>; // valid (nested in a generic argument)
```

### `type-evidence/no-unsafe-dictionary-type`

Dictionaries with broad keys (`string`, `number`, `symbol`, `PropertyKey`, or unions containing one) and contract-free values (`unknown`, `any`, `object`, `{}`) — as `Record`, index signatures, or mapped types. Finite-key records, exhaustive mapped types, nested `unknown` inside a value shape, `Map`/`WeakMap`, and type-parameter constraints stay valid.

```ts
type Dict = Record<string, unknown>; // violation
type Events = Record<string, { payload: unknown }>; // valid
```

### `type-evidence/no-known-value-widening`

A syntactically known value (literal, object, array, function, class, `new`, template) flowing into an explicitly broad annotation (`unknown`, `object`, broad `Record`, index-signature literal, anonymous type literal) discards inference. The empty-object accumulator `const acc: Record<string, T> = {}` stays valid; `{}` into `unknown`/`object` still reports.

```ts
const state: unknown = { status: "idle" }; // violation
const acc: Record<string, number> = {}; // valid
```

### `type-evidence/no-widen-then-assert`

A `const` binding declared broad over a known initializer, then re-narrowed later in the same function with an assertion, destroys evidence only to fake it back.

```ts
const data: unknown = { id: 1 };
const user = data as User; // violation
```

### `type-evidence/require-safety-comment-for-type-assertion`

Every assertion except `as const` needs a marker comment (`// SAFETY: <reason>`) on or before its owning statement. Option `{ markers: string[] }` replaces the default `["SAFETY"]`. Trailing same-line comments and empty markers do not count.

```ts
const user = input as User; // violation

// SAFETY: input validated upstream
const user = input as User; // valid
```

### `type-evidence/no-runtime-typeof`

`typeof` recreates type evidence at runtime and only reaches primitive buckets. Exceptions: existence probes (`typeof window !== "undefined"`) and, with `allowInTypeGuards: true` (the default here, unlike the source concept), any function returning a type predicate.

```ts
const kind = typeof value; // violation
if (typeof window !== "undefined") {
} // valid
```

## Limitations

All analysis is single-file and syntactic — no type checker, no cross-file resolution.

- Alias resolution follows same-file, non-generic aliases only; generic aliases are never substituted (`type Loose<T> = Record<string, T>` used as `Loose<unknown>` is not resolved).
- `no-known-value-widening` and `no-widen-then-assert` match assigned variables by name inside one function/module scope, skipping names that are declared more than once or reassigned; bindings closed over by nested functions are not tracked across scopes.
- `no-unsafe-dictionary-type` reports an unsafe alias at its declaration; consumers of that alias are intentionally not re-reported.
- `TSDeclareFunction` overload signatures are not visited by the parameter/return rules.

## Autofix

No rule is autofixable: restoring type evidence requires choosing the named contract, parser, or boundary that owns the value.

## Credits

All rules are re-implementations of concepts from [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) by Dillon Mulroy (MIT). No code was copied; each rule was implemented from the behavioral concept in this repository's own style.

## Contract boundaries and migration

Unknown input is legitimate at validation/transport boundaries. Unknown parameter/return/alias and dictionary policies exempt `boundaries/`, `decoders/`, `adapters/`, and `*.boundary.ts`-style files. Safe unknown-parameter typeof refinement and type guards are allowed by default; `allowInTypeGuards: false` deliberately tightens that convention. Internal discriminated-union preference is architecture policy, not proof that typeof is unsafe.

Populated structural contracts are not automatically evidence loss. Recursive type traversal terminates normally. Widening/reassertion and reassignment checks track lexical bindings, including captured and shadowed values. Safety comments require a non-placeholder reason of at least three words; the invariant still needs human review and a comment never proves a cast safe.

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
