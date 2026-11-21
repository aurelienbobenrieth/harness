# Catalog entry

An entry answers one question: the merchant wants this, so what does the admin do? It is filed by intent, never by component name, because the same intent often takes several shapes and the nuance between them is the value.

## Format

```markdown
### <family>.<slug>: <the merchant's goal, under ten words>

- Intent: learn <the information>; do <the action>.
- Use when: <the condition that selects this shape>. Not when: <the condition>, see `<other.id>`.
- Ask: <what only the owner can decide before building, each with the admin's default>.
- Admin: <Page > place> (`/path`), seen <YYYY-MM-DD>. Also: <other places, with what differs there>.
- Shape: <the anatomy from the outside in, with the numbers that define it>.
- Steps: <flows only: each step as trigger, what appears, what the merchant does, what follows>.
- States: <only the states that differ from rest: hover, keyboard focus, open, selected, empty, loading, error, disabled>.
- Behaviour: <click target, keyboard, what closes it, URL and history, what persists, small screens>.
- Copy: <labels and help as the admin writes them, with real examples>.
- Evidence: <measured | observed | docs>, and a URL when one documents it.
```

## Rules

- **One intent per entry.** Two shapes for one intent are two entries that point at each other through `Not when`.
- **The id is `<family>.<slug>`** and never changes once other entries cite it. The heading doubles as the index line.
- **An entry this project adds** goes in the project folder's `catalog.md`, in this format; it wins over the skill's entry of the same id. The skill's own `catalog.md` is generated: never edit it by hand.
- **`Ask` lists product decisions, not design ones.** The admin already answers how it looks and behaves. What it cannot answer is what this screen is for: which columns, which filters, which actions, what a row opens, what the empty state invites to. Write each as a short question with the admin's default in brackets, for example "Sortable? [yes, by date, newest first]". Leave the line out when the entry leaves nothing open, as for a copy icon.
- **Interactions are part of the entry.** `States` and `Behaviour` say what hover, press, keyboard focus, open and disabled look like, and what each click, key and close does. An entry that only describes the resting screen is `observed` at best, whatever was measured.
- **A flow is its own entry** in the `flow` family when a task crosses several steps or surfaces: create a record from an unsaved page, configure in a modal, delete with a confirmation. Its `Steps` line follows the merchant from the trigger to the state after, and cites the entry of each surface it crosses.
- **Numbers belong to the admin.** Write a number only if it was measured. The compared values live in the entry's sheet; keep in the entry the few numbers that define the shape.
- **Omit a line that has nothing to say**, except `Intent`, `Use when`, `Admin` and `Evidence`.
- **An entry describes the admin only.** Which component implements it, its gaps and the owner's decisions go in the project's `components.md`; how to compose it with a UI kit goes in `recipes/<kit>.md`, one line per entry id: `<the composition>; custom: <what the kit cannot do, or none>`.

## Evidence

| Level      | Meaning                                                                            | Before building from it                               |
| ---------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `measured` | Computed styles and boxes were read from the admin's markup, in every state listed | Compare against its sheet                             |
| `observed` | Seen and described in the live admin; not measured                                 | Measure it, then upgrade the entry                    |
| `docs`     | Read on shopify.dev only                                                           | Find it in the admin, measure, then upgrade the entry |

## Families

| Family       | The merchant wants to                                     |
| ------------ | --------------------------------------------------------- |
| `index`      | browse, find, narrow and act on many records              |
| `detail`     | read one record and act on it                             |
| `form`       | create or edit a record                                   |
| `settings`   | configure how something behaves                           |
| `fields`     | give one value                                            |
| `actions`    | trigger something: buttons, links, menus and their states |
| `data`       | read numbers and trends                                   |
| `onboarding` | get started, learn, connect, upgrade                      |
| `feedback`   | know what happened, what is wrong, what something means   |
| `overlay`    | do a short task without leaving the page                  |
| `navigation` | move between places and come back                         |
| `flow`       | complete a task that crosses several steps or surfaces    |
| `chrome`     | use the admin frame around the app (host-owned)           |
| `copy`       | read wording that sounds like the admin                   |

A new family needs at least three entries that fit no existing one.
