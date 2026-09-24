# @aurelienbbn/oxlint-plugin-core

**15 oxlint rules for any TypeScript codebase: swallowed errors, flaky or hollow tests, test code in production, anonymous public contracts.**

```sh
pnpm add -D @aurelienbbn/oxlint-plugin-core oxlint   # oxlint >=1.82.0 <2.0.0
```

```json
{
  "jsPlugins": ["@aurelienbbn/oxlint-plugin-core"],
  "rules": {
    "core/no-discarded-caught-error": "error",
    "core/no-weak-test-assertions": ["error", { "assertionHelpers": ["assertValid"] }],
    "core/no-test-sleeps": "error"
  }
}
```

**No preset, no autofix.** Enable each rule by name; every fix needs a decision a tool can't make.

<details>
<summary>Rules by job, options, and the decision each fix needs</summary>

| Job          | Rules                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧯 errors    | `no-discarded-caught-error`, `no-error-message-matching`                                                                                                                           |
| 🧪 tests     | `no-weak-test-assertions`, `no-test-sleeps`, `no-stubbed-subject`, `no-ambient-nondeterminism-in-tests`, `no-vitest-mocking`, `no-vitest-in-source`, `no-test-logic-in-production` |
| 📜 contracts | `no-exported-anonymous-object-return`, `no-multi-positional-parameters`, `no-mutable-exported-state`, `no-reexport-only-modules`, `no-let`                                         |
| 💬 comments  | `no-dead-comments`                                                                                                                                                                 |

| Rule                                 | Option                                       | Default                                 |
| ------------------------------------ | -------------------------------------------- | --------------------------------------- |
| `no-discarded-caught-error`          | `logOnlyCallees`                             | `["console", "logger", "log"]`          |
|                                      | `reasonMarker`                               | `"REASON"`                              |
|                                      | `includeTestFiles`                           | `false` (test files exempt)             |
| `no-ambient-nondeterminism-in-tests` | `allowClock`                                 | `false`; `true` waives clock reads only |
| `no-weak-test-assertions`            | `assertionHelpers`                           | `[]`                                    |
| `no-vitest-mocking`                  | `forbidSpies`                                | `false` (`vi.fn`, `vi.spyOn` allowed)   |
| `no-reexport-only-modules`           | `allow`                                      | `["index.ts"]`                          |
| `no-multi-positional-parameters`     | `exemptFunctionNames`, `exemptFileBasenames` | `[]`, `[]`                              |

| Rule                                  | The decision its fix needs                                              |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `no-ambient-nondeterminism-in-tests`  | the scenario's locale, frozen instant, or seed                          |
| `no-dead-comments`                    | a bare TODO: track it or delete it                                      |
| `no-discarded-caught-error`           | rethrow, branch on the error, or record a reason                        |
| `no-error-message-matching`           | the stable discriminator (class, tag, code) depends on the error source |
| `no-exported-anonymous-object-return` | the schema/type name and where it's exported                            |
| `no-let`                              | restructure the value construction, not swap a keyword                  |
| `no-multi-positional-parameters`      | update callers, pick property names                                     |
| `no-mutable-exported-state`           | a factory, an immutable contract, or a dependency boundary              |
| `no-reexport-only-modules`            | reroute every consumer to the owning module                             |
| `no-stubbed-subject`                  | which collaborator to replace instead                                   |
| `no-test-logic-in-production`         | an injected dependency or a public contract                             |
| `no-test-sleeps`                      | a condition to poll or a fake-timer schedule                            |
| `no-vitest-in-source`                 | the right test utility or dependency seam                               |
| `no-vitest-mocking`                   | the dependency boundary and the fake                                    |
| `no-weak-test-assertions`             | which observable outcome each test asserts                              |

</details>

## 🧯 A caught error is handled or explained

```ts
try {
  await sync();
} catch (error) {
  console.error(error);
  return [];
} // ❌ only logged
promise.catch(() => null); // ❌ discarded
promise.catch(handleFailure); // ✅ handed to a function
try {
  access(path);
  return true;
} catch {
  // REASON: a missing file is the negative answer here
  return false; // ✅ reasoned
}

return err.message === "Not found"; // ❌ no-error-message-matching
return error instanceof TimeoutError; // ✅ class, tag, or code
```

<details>
<summary><code>no-discarded-caught-error</code> and <code>no-error-message-matching</code> details</summary>

`no-discarded-caught-error` covers `catch` clauses, inline `.catch(fn)`, and an inline second argument of `.then`, when the handler never throws (nor returns `Promise.reject(...)`) and the binding is absent or only reaches `console.*` / `logger.*` / `log.*`.

```ts
try {
  return await load(id);
} catch (error) {
  throw new LoadError({ id, cause: error });
} // ✅ rethrown
try {
  return await load();
} catch (error) {
  if (isNotFound(error)) return undefined;
  throw error;
} // ✅ inspected
```

| Case                                       | Behavior                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| counts as handling                         | passing the error to any non-log function, returning it, testing it                                                                                          |
| escape hatch                               | `REASON: <≥ 3 words>` inside the handler; promise callbacks also directly above the statement. Placeholders (`todo`, `ignored`, `this is fine`…) don't count |
| `catch {}` (literally empty)               | ⏭️ left to `eslint/no-empty`                                                                                                                                 |
| `Effect.catch(...)`                        | ⏭️ capitalized receivers are namespaces, skipped                                                                                                             |
| schema builders with instance `.catch(fn)` | ⚠️ need a reason or a disable comment                                                                                                                        |

`no-error-message-matching`: `.message` compared with a string literal, fed to `includes` / `startsWith` / `endsWith` / `match` / `search` / `indexOf` / `RegExp#test` (also after `toLowerCase()`-style calls), or used as a `switch` discriminant. `String(error)`, `error.toString()`, `` `${error}` `` on a caught binding count too. Test files exempt. Error-shaped = catch binding, rejection-handler parameter, or a name like `e`, `err`, `error`, `cause`, `reason`, `ex`, `exception`, `*Error`, `*Err`, `*Exception`.

</details>

## 🧪 A test proves behavior, deterministically

**`no-weak-test-assertions` judges per test: one strong assertion clears it.**

| ❌ Weak                                    | ✅ Strong                                      |
| ------------------------------------------ | ---------------------------------------------- |
| `expect(load()).toBeDefined()`             | `expect(load()).toEqual({ id: 1 })`            |
| `expect(() => run()).not.toThrow()`        | `expect(() => run()).toThrow("boom")`          |
| `toHaveBeenCalledWith(expect.any(Object))` | `toHaveBeenCalledWith(expect.any(String), 30)` |

```ts
await new Promise((r) => setTimeout(r, 500)); // ❌ no-test-sleeps
await vi.waitFor(() => expect(state()).toBe("done")); // ✅ poll the condition

// cart.test.ts
vi.spyOn(cart, "total").mockReturnValue(30); // ❌ no-stubbed-subject
vi.spyOn(pricing, "rate").mockReturnValue(2); // ✅ another module

export const send = (mail) => (process.env.NODE_ENV === "test" ? undefined : deliver(mail)); // ❌ no-test-logic-in-production
```

**Projects using Vitest in-source testing turn `no-test-logic-in-production` off for those files.**

<details>
<summary>Every weak shape, sleep shape, nondeterminism source, and test-only marker</summary>

**Weak assertions**

| ❌ Weak                                              | ✅ Strong                                           |
| ---------------------------------------------------- | --------------------------------------------------- |
| `.toBeTruthy()`                                      | an exact value                                      |
| `expect(true).toBe(true)` (literal vs literal)       | `expect(3).toBe(add(1, 2))` (literal vs computed)   |
| `expect(result).toEqual(result)` (value vs itself)   | `expect(render()).toMatchSnapshot()`                |
| `expect(fn()).toBe(5)` after `fn.mockReturnValue(5)` | `fc.assert(fc.property(…))`                         |
| `toEqual(expect.anything())`                         | `toEqual({ id: expect.any(String), total: 30 })`    |
| bare `toHaveBeenCalled()` / `toBeCalled()`           | `.not.toHaveBeenCalled()` ("never called" is exact) |
| `toBeInstanceOf(Object)`                             | `toEqual(expect.any(Order))`                        |
| `expect(typeof x).toBe("string")`                    |                                                     |

Wildcards = `expect.anything()`, `expect.any(Object | Function | Array | String | Number | Boolean)`, `expect.objectContaining({})`, `expect.arrayContaining([])`. **Bare `toThrow()` isn't counted:** `vitest/require-to-throw-message` owns it, pinned for test files by `@aurelienbbn/oxlint-config`.

**Sleeps** (`*.test.*` / `*.spec.*`)

```ts
await new Promise((r) => setTimeout(r, 500)); // ❌ timer-only executor
import { setTimeout as sleep } from "node:timers/promises"; // ❌ also `scheduler`
await sleep(250); // ❌ sleep / delay / wait / pause + numeric literal
```

Files calling `vi.useFakeTimers()` skip the first and last shape: their timers aren't wall-clock.

**Ambient nondeterminism** (concept: "Eradicating Non-Determinism in Tests", Martin Fowler)

| ❌ Fires on                                                                     | Unless                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` without a locale | —                                                                         |
| `localeCompare` without its 2nd argument                                        | —                                                                         |
| `Intl.*Format` constructed without a locale                                     | —                                                                         |
| `Math.random()`                                                                 | —                                                                         |
| `new Date()` (no arg), `Date.now()`, `performance.now()`                        | file calls `vi.useFakeTimers` / `vi.setSystemTime`, or `allowClock: true` |

Shadowed `Date` / `Math` / `Intl` stay silent.

**Stubbed subject** (`<stem>.test.*` / `<stem>.spec.*`)

```ts
import * as cart from "./cart"; // also ./cart.js, ../cart/index
vi.spyOn(cart, "total"); // ✅ pass-through spy
```

Namespace or default import of the same-stem relative module; canned behavior via `mockReturnValue`, `mockResolvedValue`, `mockRejectedValue`, `mockImplementation` (and `…Once`), chained or on the spy's `const`. Package imports stay silent.

**Test logic in production** (concept: "Test Logic in Production", G. Meszaros, _xUnit Test Patterns_). Silent in test files, Vitest config and setup files, `/test-utils/`, `/testing/` (the paths `no-vitest-in-source` allows).

```ts
export const send = (mail) => (process.env.NODE_ENV === "test" ? undefined : deliver(mail)); // ❌ also import.meta.env.MODE === "test"
export const retries = process.env.VITEST ? 0 : 3; // ❌ also VITEST_WORKER_ID, JEST_WORKER_ID, import.meta.vitest
export const __testing__ = { parse }; // ❌ name marks it test-only
/** Visible only for unit tests. */
export const parse = (input) => input; // ❌ comment marks it test-only
```

Test-only names: `__test__` / `__tests__` / `__testing__`, `_internal(s)`, `internals`, `testOnly*`, `*ForTest` / `*ForTests` / `*ForTesting`. Comments like "exported for testing" or "visible only for tests" directly above the export.

**Vitest APIs:** `no-vitest-in-source` reports importing `vitest` from non-test source; `no-vitest-mocking` reports module replacement via Vitest mock APIs, plus `vi.fn` / `vi.spyOn` with `forbidSpies: true`.

</details>

## 📜 Public contracts are named

```ts
export const getUser = () => ({ id: user.id }); // ❌ no-exported-anonymous-object-return
export const load: Load = () => ({ id: user.id }); // ✅ named contract

const loadUser = (userId: UserId, includePosts: boolean) => userId; // ❌ no-multi-positional-parameters
export function loadUser(input: { userId: UserId; includePosts: boolean }) {} // ✅ object input

export let currentUserId = undefined; // ❌ no-mutable-exported-state
export * from "./user.js"; // (whole file)                    // ❌ no-reexport-only-modules, unless listed in `allow`
let total = 0; // ❌ no-let (also `var`)
```

## 💬 Comments describe code, not its history

```text
// Updated to use the new pricing API    ❌ change narration (line comments)
// TODO: rename this contract            ❌ untracked
// TODO(#123): rename this contract      ✅ tracked (also CART-42 or a link)
/** Updated when the cache expires */    ✅ docblock describing behavior
```

<details>
<summary>Every <code>no-dead-comments</code> shape</summary>

| ❌ Fires                                                                                                 | ✅ Stays silent                                |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `// NEW:` / `// Updated:` / `// Fixed:` labels                                                           | `// New customers receive a welcome discount`  |
| `// Previously this…` / `// Formerly:` / `// Was:`                                                       | `// Previously seen cursors are skipped`       |
| `// Added … as requested` / `… for the review`                                                           | `// TODO CART-42: tighten the types` or a link |
| line comments only: `// Updated to…` / `// Changed from…` / `// Now returns…` / `// No longer supports…` |                                                |

Also closing-brace labels and placeholder scaffolding; narration counts only when anchored at the comment start.

</details>

## ⚠️ Migration

| Now reports    | Example                                                                                                    | Fix (no autofix)                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| aliased export | `const read = () => ({ id: 1 }); export { read as load };`                                                 | named return type, same as a direct export                       |
| aliased Vitest | `spec.each(rows)("exists", row => check(row).toBeDefined())` when `spec` / `check` alias `test` / `expect` | assert the observable value, or register a real assertion helper |

<details>
<summary>Contract: what each rule does and doesn't resolve</summary>

| Topic                  | Contract                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| architectural policy   | named exported object contracts and object-style parameters are policy, not proof of a bug                                                                                                                                                    |
| public-return analysis | ✅ direct exports, same-file export lists/aliases, const forwarding aliases, default identifiers, explicit overload signatures · ⏭️ nested helper returns stay private · ❌ external re-exports and package entrypoint traversal not resolved |
| callback arity         | externally imposed callback arities exempt                                                                                                                                                                                                    |
| `no-let`               | optional: deliberate local mutation can be clearer and faster                                                                                                                                                                                 |
| mutable exports        | forward exports handled without conflating local declarations                                                                                                                                                                                 |
| weak assertions        | judged per test; recognizes real `expect` chains and meaningful snapshot/property assertions; arbitrary matcher-named methods aren't proof                                                                                                    |
| Vitest recognition     | named aliases, namespace imports, unshadowed globals, `each`, conditional modifiers. Local shadows stay outside the Vitest rules. Fast-check assertions support imported aliases                                                              |
| `assertionHelpers`     | trusts calls with that local name: the helper's behavioral contract is on you. Cross-module wrapper inference unsupported                                                                                                                     |

</details>

<!-- harness-catalog:start -->

## Registered contract inventory

Generated from package exports by `pnpm catalog`. Rule-specific options and limitations are described above and in the source tests.

| Rule/check                            | Trigger or review scope                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-ambient-nondeterminism-in-tests`  | Disallow test files from depending on the host locale, the real clock, or `Math.random()`: locale-sensitive formatting without a locale, `new Date()` / `Date.now()` / `performance.now()` without fake timers, and unseeded randomness.   |
| `no-dead-comments`                    | Disallow dead comments: closing-brace labels, placeholder scaffolding, untracked TODOs, and comments narrating a change instead of the code.                                                                                               |
| `no-discarded-caught-error`           | Require a catch clause or inline promise rejection handler that never rethrows and ignores or only logs the error to carry a reasoned marker comment.                                                                                      |
| `no-error-message-matching`           | Disallow branching on the text of an error message through string comparison, substring or regex matching, or a switch.                                                                                                                    |
| `no-exported-anonymous-object-return` | Require named object return contracts for functions exported directly, by local alias, or as a default identifier.                                                                                                                         |
| `no-let`                              | Disallow let and var declarations in favor of const and expression-oriented code.                                                                                                                                                          |
| `no-multi-positional-parameters`      | Require object inputs instead of multiple positional parameters for functions.                                                                                                                                                             |
| `no-mutable-exported-state`           | Disallow exporting mutable module state.                                                                                                                                                                                                   |
| `no-reexport-only-modules`            | Disallow modules that only re-export other modules, except allowed entrypoint barrels.                                                                                                                                                     |
| `no-stubbed-subject`                  | Disallow a `<stem>.test` file from replacing behavior of its own `<stem>` module through `vi.spyOn(...)` followed by a canned return value or implementation.                                                                              |
| `no-test-logic-in-production`         | Disallow production files from branching on a test runner or test mode and from exporting members named or commented as existing only for tests.                                                                                           |
| `no-test-sleeps`                      | Disallow wall-clock sleeps in test files: setTimeout-backed promises, node:timers/promises sleeps, and awaited sleep helpers with a fixed duration.                                                                                        |
| `no-vitest-in-source`                 | Disallow importing vitest from non-test source files.                                                                                                                                                                                      |
| `no-vitest-mocking`                   | Disallow Vitest mocking APIs in favor of deterministic test doubles.                                                                                                                                                                       |
| `no-weak-test-assertions`             | Disallow individual tests whose only assertions check existence, a bare call, a `typeof` or `Object` instance, wildcard-only matcher arguments, a value against itself or a literal against a literal, or a local mock's own return value. |

### Credited concepts

- "Eradicating Non-Determinism in Tests" by Martin Fowler (concept)
- "Test Logic in Production" (G. Meszaros, xUnit Test Patterns) (concept)
- code-slop by asyrafhussin (MIT, concept re-implemented)
- code-slop by asyrafhussin (MIT, concept re-implemented) — closing-brace labels and placeholder

<!-- harness-catalog:end -->
