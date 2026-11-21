---
name: shopify-pattern
description: Build, change, compare or score a screen, section or component of an embedded Shopify app so the merchant cannot tell it from the admin, from a catalog of admin patterns filed by merchant intent and the admin's measured values. Works with any stack and UI kit; what is specific to the app lives in a project folder. Use before any merchant-facing UI in an embedded Shopify app, and when asked to score, roast or audit how native it is. Not for backend, non-visual work or App Store readiness.
---

# Shopify pattern

| Command                                                           | Does                                                                  | Changes the app                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `/shopify-pattern <what to build or change>`                      | the whole loop                                                        | yes                                |
| `/shopify-pattern compare <route or element>`                     | steps 1, 2, 6 and 8 on what exists                                    | no                                 |
| `/shopify-pattern score <component, section, page, route or app>` | [score](references/score.md)                                          | not until the owner picks findings |
| `/shopify-pattern measure <intent or entry id>`                   | steps 1, 2, 4 and 7: measure the admin, write the entry and its sheet | no                                 |

The admin is the reference. A [value sheet](references/sheets.md) holds what was measured there; the catalog, existing components and neighbour screens only point to it.

## Two folders

- **This skill** says what the admin does: `catalog.md`, `catalog/<family>.md`, `sheets/<entry id>.json`, `recipes/<UI kit>.md`, `scripts/`. It knows no app. Do not write in it.
- **The project folder,** `.agents/shopify-pattern/` at the repo root, says what is true of this app ([project](references/project.md)). It starts absent; each file appears the first time a pass has something to record. Read what exists at the start of a pass; every write-back goes there.

## Loop

Per element the task touches ([loop](references/loop.md) has each step in full):

1. **Intent:** one line: what the merchant learns and does next.
2. **Lookup** the project's `catalog.md`, then [catalog.md](catalog.md). No entry: research and write one.
3. **Ask before any code,** in one round. Listing "decisions to confirm" after the build is a failure.
4. **Get the admin's values** from a sheet under 30 days old, or measure the admin. A failed browser call stops that element.
5. **Build** with the first rung of the project's build ladder that works.
6. **Compare** each state the sheet holds until 0 differences are left.
7. **Write back, in the same pass,** to the project folder.
8. **Report** with the block in [report](references/report.md): an element not compared in this pass is not done.

## Rules

- **Form, not substance.** Layout, shape and wording may change; no setting, fact or behaviour the merchant needs disappears.
- **The admin wins over the sheet, the sheet over the entry's text.** Differs today: measure again, correct both.
- **The owner's rules** in `project.md` apply unless a sheet shows otherwise.
- **The host draws the chrome** (`chrome.*`: modal, save bar, toast, title bar, navigation). Ask for it through App Bridge; an app screen never draws it.
- **Admin writes.** A dev store only. Read only, except one record named `zz pattern test` when a state needs it, deleted in the same pass and named in the report.
- **No analog.** Search the whole admin and Shopify's own apps first, then compose the nearest entries and write `Admin: none` with the reason.
- **UI kit.** No private variable, internal class or shadow selector outside one documented adapter with a fallback.
- **Copy is part of the pattern.** The admin's wording and length in every locale ([catalog/copy.md](catalog/copy.md)).
