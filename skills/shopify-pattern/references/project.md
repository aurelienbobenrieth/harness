# The project folder

The skill describes the admin and knows no app. Everything about this app is in `.agents/shopify-pattern/` at the repo root, committed with the code. The skill reads it at the start of every pass and writes back to it.

| File                    | Holds                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `project.md`            | stack, UI kit, how to open the app and the admin, the compare command, build ladder, owner rules, variants, traps                                                        |
| `components.md`         | one line per component: ``- `<entry id>`: `<repo path>`, iso`` or `gaps: ...`; owner decisions that differ from the admin on purpose. An entry with no line is not built |
| `ours/<entry id>.json`  | where the sheet's parts are on our screen and how to reach each state: `{ "root", "parts": { "<name>": <locator> }, "steps" }`                                           |
| `calibration.md`        | screens the owner scored, used as anchors by `score`                                                                                                                     |
| `catalog.md`, `sheets/` | entries and sheets this project added or measured again; same formats as the skill's, and they win over it                                                               |
| `scripts/`              | whatever opens this app for the compare, if the project automates it                                                                                                     |

## No setup

The skill asks nothing of the app before the first pass: no dependency, no change to its code, no configuration file. Looking up an entry and reading a sheet need only the skill.

A file is created the first time a pass learns something worth keeping:

| File                   | Appears when                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project.md`           | the pass has to open the app or the admin. Read the repo first (`package.json` and lockfile for the framework and the UI kit, where shared components live, how the dev server starts, the locales), then ask the owner once only what the repo cannot say: the dev store, rules they already hold about the UI, states that change a screen |
| `ours/<entry id>.json` | a compare needs to find a part on our screen                                                                                                                                                                                                                                                                                                 |
| `components.md`        | a compare ran: a line says `iso` only after it printed 0 differences, never by guess                                                                                                                                                                                                                                                         |
| `calibration.md`       | the owner gives a score                                                                                                                                                                                                                                                                                                                      |

What a pass needs from the session, only at the step that uses it:

- **Compare and score:** a browser tool that can evaluate an expression in the app's document.
- **Measure:** a browser profile signed in to a dev store, only when a sheet is missing or older than 30 days.

## `project.md`

```markdown
# <App> for shopify-pattern

- Stack: <framework, language, styling>
- UI kit: <name>; recipe: `recipes/<kit>.md` | none
- Dev store: <admin URL>
- Open the app: <command that starts it; the URL of a route>
- Compare: <the one command, when scripted> | by hand, see the skill's step 6
- Variants: <what changes a screen and how to reach each>
- Write-back: this folder | <another place, with the reason>

## Build ladder

1. <the component `components.md` names> 2. <the kit's component> 3. <where a new shared component goes> 4. <custom CSS, where>

## Owner rules

- <rule, and where it came from>

## Traps

- <what cost a pass here: a build step, a frame, a port>
```

## Opening the app

The compare needs one thing from the project: a way to evaluate an expression inside the app's document.

- **An embedded app runs in an iframe of the admin.** Evaluate in that frame, not in the admin's page: the browser tool must target the frame (Playwright `frame.evaluate`, a DevTools frame context). A tool that only reaches the top page cannot compare; say so with the failed call.
- **A local mock of the admin, or a route that renders outside the admin,** is the easy case: open it and evaluate.
- **Scripted:** a project script opens the route, runs the steps of `ours/<entry id>.json`, evaluates `expression(...)` and prints `compare(...)`, both exported by the skill's `scripts/compare.cjs`. Name it on the `Compare` line.

## Locating parts in existing code

A sheet names parts (`marker`, `row-title`). On our screen each is found, in this order, by its locator in `ours/<entry id>.json`, then by `data-part="<name>"`.

- **Existing or third-party markup:** write locators in the map; nothing changes in the app. Find them with `scripts/outline.js` evaluated on our screen. Locator syntax: top of `scripts/probe.js`.
- **Components you own and will reuse:** `data-part` on the element saves a map for every screen that uses the component.
