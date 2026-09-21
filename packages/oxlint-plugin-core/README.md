# @aurelienbbn/oxlint-plugin-core

Custom oxlint rules for TypeScript projects.

## Rules

See the [registered contract inventory](#registered-contract-inventory) for current triggers.

### Failure handling and test timing

- `core/no-discarded-caught-error` fires on a `catch` clause, an inline `.catch(fn)` callback, or an inline second argument of `.then` that never throws (nor returns `Promise.reject(...)`) and whose error binding is absent or only reaches `console.*` / `logger.*` / `log.*` calls. Passing the error to any other function, returning it, or testing it counts as handling. Escape hatch: a `REASON: <at least three words>` comment inside the handler (for promise callbacks also directly above the statement). Options: `logOnlyCallees`, `reasonMarker`, `includeTestFiles` (test files are exempt by default). A literally empty `catch {}` is left to `eslint/no-empty`. Capitalized receivers such as `Effect.catch(...)` are namespaces and are skipped; schema builders exposing an instance `.catch(fn)` need a reason or a disable comment.
- `core/no-error-message-matching` fires when `.message` of an error-shaped value (a catch binding, a rejection-handler parameter, or a name like `e`, `err`, `error`, `cause`, `reason`, `ex`, `exception`, `*Error`) is compared with a string literal, fed to `includes` / `startsWith` / `endsWith` / `match` / `search` / `indexOf` / `RegExp#test` (also after `toLowerCase()`-style calls), or used as a `switch` discriminant. `String(error)`, `error.toString()` and `` `${error}` `` on a caught binding count too. Test files are exempt.
- `core/no-test-sleeps` fires in `*.test.*` / `*.spec.*` files on `new Promise` executors whose `setTimeout` callback only resolves the promise, on importing `setTimeout` or `scheduler` from `node:timers/promises`, and on awaited `sleep` / `delay` / `wait` / `pause` calls with a numeric literal. Files that call `vi.useFakeTimers()` are skipped for the first and last shape because their timers are not wall-clock.
- `core/no-weak-test-assertions` also treats as weak: an `expect` whose subject and expected values are all literals (`expect(true).toBe(true)`), an `expect` comparing an identifier or member path with itself (`expect(result).toEqual(result)`), and an `expect` on the direct result of a local `vi.fn()` binding (`expect(fn()).toBe(5)` after `mockReturnValue(5)`). A literal subject compared with a computed value (`expect(3).toBe(add(1, 2))`) stays strong.
- `core/no-dead-comments` also reports change narration anchored at the start of a comment: `NEW:` / `Updated:` / `Fixed:`-style labels, `Previously this…` / `Formerly:` / `Was:`, `Added … as requested` / `for the review`, and, in line comments only, `Updated to…` / `Changed from…` / `Now returns…` / `No longer supports…`. Docblocks describing behavior ("Updated when the cache expires") and sentences that merely start with a similar word ("New customers receive…", "Previously seen cursors…") stay silent.

### Test quality

- `core/no-weak-test-assertions` also treats as weak: a matcher whose arguments are all wildcards (`expect.anything()`, `expect.any(Object | Function | Array | String | Number | Boolean)`, `expect.objectContaining({})`, `expect.arrayContaining([])`), such as `toHaveBeenCalledWith(expect.any(Object))` or `toEqual(expect.anything())`; a bare `toHaveBeenCalled()` / `toBeCalled()`; `toBeInstanceOf(Object)`; and `expect(typeof x).toBe("<literal>")`. One concrete argument keeps the matcher strong: `toHaveBeenCalledWith(expect.any(String), 30)`, `toEqual({ id: expect.any(String), total: 30 })`, `toEqual(expect.any(Order))`. `.not.toHaveBeenCalled()` is left alone because "never called" is exact. A bare `toThrow()` is not counted here: `vitest/require-to-throw-message` already reports it, and `@aurelienbbn/oxlint-config` pins that rule for test files.
- `core/no-stubbed-subject` fires in `<stem>.test.*` / `<stem>.spec.*` on `vi.spyOn(ns, "member")` when `ns` is a namespace or default import of the relative module with the same stem (`./cart`, `../cart.js`, `./cart/index` for `cart.test.ts`) and the spy receives canned behavior through `mockReturnValue`, `mockResolvedValue`, `mockRejectedValue` or `mockImplementation` (and their `Once` forms), chained or called on the spy's `const` binding. Pass-through spies, package imports and other modules stay silent.
- `core/no-test-logic-in-production` fires outside test files, Vitest config and setup files, `/test-utils/` and `/testing/` (the paths `core/no-vitest-in-source` allows) on: comparing `process.env.NODE_ENV` or `import.meta.env.MODE` with `"test"`; reading `process.env.VITEST`, `process.env.VITEST_WORKER_ID`, `process.env.JEST_WORKER_ID` or `import.meta.vitest`; a value export named `__test__` / `__tests__` / `__testing__`, `_internal(s)`, `internals`, `testOnly*` or `*ForTest` / `*ForTests` / `*ForTesting`; and an export directly preceded by a comment such as "exported for testing" or "visible only for tests". Projects that use Vitest in-source testing turn the rule off for those files. Concept credit: "Test Logic in Production", G. Meszaros, _xUnit Test Patterns_.
- `core/no-ambient-nondeterminism-in-tests` fires in test files on `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` without a locale, `localeCompare` without its second argument, `Intl.*Format` constructed without a locale, `Math.random()`, and on `new Date()` with no argument, `Date.now()` and `performance.now()` when the file never calls `vi.useFakeTimers` or `vi.setSystemTime`. Option `allowClock: true` waives the clock reads only. Shadowed `Date` / `Math` / `Intl` bindings stay silent. Concept credit: "Eradicating Non-Determinism in Tests" by Martin Fowler.

The plugin ships no preset: every rule, these three included, is enabled by name in the consumer's `rules`.

## Autofix

`core/no-ambient-nondeterminism-in-tests` is not autofixable because the right locale, frozen instant, or seed belongs to the scenario under test.
`core/no-dead-comments` is not autofixable because a bare TODO needs a human decision between tracking it and deleting it.
`core/no-discarded-caught-error` is not autofixable because choosing between rethrowing, branching on the error, and recording a reason is the decision the rule asks for.
`core/no-error-message-matching` is not autofixable because the stable discriminator (error class, tag, or code) depends on the error source.
`core/no-exported-anonymous-object-return` is not autofixable because naming a public contract requires choosing the schema/type name and export location.
`core/no-let` is not autofixable because removing reassignment requires restructuring the value construction, not swapping a keyword.
`core/no-multi-positional-parameters` is not autofixable because changing call signatures requires updating callers and choosing property names.
`core/no-mutable-exported-state` is not autofixable because replacing shared mutable state requires choosing a factory, immutable contract, or dependency boundary.
`core/no-reexport-only-modules` is not autofixable because rerouting imports to the owning modules requires updating every consumer.
`core/no-stubbed-subject` is not autofixable because removing the stub means choosing which collaborator to replace instead.
`core/no-test-logic-in-production` is not autofixable because the test-only branch or export has to be replaced by an injected dependency or a public contract.
`core/no-test-sleeps` is not autofixable because the replacement is either a condition to poll or a fake-timer schedule, which only the test author knows.
`core/no-vitest-in-source` is not autofixable because moving test-only APIs out of production source requires choosing the correct test utility or dependency seam.
`core/no-vitest-mocking` is not autofixable because replacing mocks requires choosing the right dependency boundary and fake implementation.
`core/no-weak-test-assertions` is not autofixable because pinning behavior requires deciding which observable outcome each test should assert.

## Contract boundaries and migration

Named exported object contracts and object-style parameters are architectural policy. Public-return analysis covers direct exports, same-file export lists/aliases, const forwarding aliases, default identifiers, and explicit overload signatures. Nested helper returns remain private. External re-exports and package entrypoint traversal are not resolved. Externally imposed callback arities are exempt. `no-let` remains optional; deliberate local mutation can be clearer and faster. Re-export entrypoints use the `allow` option (`index.ts` by default).

Mutable export detection handles forward exports without conflating local declarations. Module replacement through Vitest mock APIs is banned by default; `vi.fn` and `vi.spyOn` are allowed unless `forbidSpies: true`. Weak-assertion detection is per test, recognizes actual expect chains and meaningful snapshot/property assertions, and does not use arbitrary matcher-named methods as proof of behavior.

Vitest test/expect/vi recognition supports named aliases, namespace imports, unshadowed globals, `each`, and conditional modifiers. Local shadows remain outside the Vitest rules. Fast-check assertions support imported aliases. A custom helper can be registered through `no-weak-test-assertions: ["error", { assertionHelpers: ["assertValidOrder"] }]`; this explicitly trusts calls with that local name, so its behavioral contract remains the consumer's responsibility. Cross-module wrapper inference is unsupported.

Migration: `const read = () => ({ id: 1 }); export { read as load };` now needs a named return type just as a direct export does. `spec.each(rows)("exists", row => check(row).toBeDefined())` is now recognized when `spec`/`check` alias Vitest's `test`/`expect`; assert the observable value or register an actual assertion helper. Neither change has an autofix.

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
