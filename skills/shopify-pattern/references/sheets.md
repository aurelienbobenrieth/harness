# Value sheets

A sheet is an entry's `Shape` and `States` lines as values a script compares: `sheets/<entry id>.json`. `scripts/compare.cjs` reads it and prints only the differences with our screen, so nobody reads a dump and the admin is opened only when the sheet is missing or stale (older than 30 days, or contradicted by the admin).

A sheet holds the admin's side only. Where the parts are on our screen is the project's `ours/<entry id>.json` ([project](project.md)). A sheet this project writes goes to the project folder's `sheets/`.

## Format

```json
{
  "entry": "detail.timeline",
  "admin": "Orders > #1044",
  "path": "/orders/6649667223691",
  "adminSteps": "what to click to reach the state, in plain words",
  "measured": "2026-11-16",
  "viewport": 1440,
  "root": "section",
  "rootWidth": 760,
  "locate": {
    "section": "[class*=\"_Timeline_\"]",
    "marker": { "sel": "[class*=\"_DefaultMarker_\"]", "in": "section" }
  },
  "parts": { "marker": { "x": 28, "w": 16, "h": 16, "radius": "4", "bg": "#dddddd" } },
  "states": { "hover": { "adminSteps": "...", "locate": {}, "parts": {} } }
}
```

- `admin` and `path` name the place in the store it was measured in. In another store, open the same kind of record; `<store name>` and `<app name>` in a locator stand for yours.
- `locate`: where each part is in the admin, so measuring again is one call. Locator syntax: top of `scripts/probe.js`.
- `parts`: the values to compare, exactly as the probe prints them: `x`, `w`, `h`, `right` (distance to the root's right edge), `font` ("size/line weight"), `color`, `bg`, `radius`, `pad`, `gap`, `border`, `shadow`.
- An entry with nothing to measure (a rule, a wording choice, a flow whose surfaces have their own sheets) has no sheet and one line in `sheets/_none.json`: `"<entry id>": "<reason, and the sheets that cover its surfaces>"`.

## Measure the admin

1. Open the entry's `Admin` place ([reach the admin](method.md#reach-the-admin)) and record the viewport width the tab really has (`innerWidth`). Read only: a modal opened to measure is cancelled, nothing is saved.
2. Find the parts: evaluate `scripts/outline.js` as `(<file>)("text:<a word of the pattern>", 60)`.
3. Write `locate`, one named part per thing the `Shape` line names. Install the probe once per page load, `window.probe = <content of scripts/probe.js>`, then `probe(<locate>, "<root>")`. For an existing sheet, `node scripts/compare.cjs <sheet> --expr admin` prints the whole call.
4. Keep in `parts` only what the eye can see, then write the sheet. One more block under `states` for each state the entry lists and you can reach without writing. Hover, focus and custom menus need the browser tool's real pointer and keyboard (hover, click at x and y, press Tab), not synthetic events.

## What a part keeps

- Colours and radii on the element that paints them, not on a wrapper that only clips or inherits.
- `w` only for a fixed-size thing (an icon, an avatar, a pill of fixed text); never for text or a fluid block. `x` for what hangs from the left edge, `right` for the right edge.
- `font` and `color` on the element that holds the text.
- No `y`: it follows the content above.
- A value that cannot be resolved (`clamp(...)`, a gradient) is left out and named in `adminSteps` or the entry.

## Locators that last

- Prefer a tag, a role, an `aria-label` or the visible text. A hashed class is matched by its stable part: `[class*="_EventWrapper_"]`.
- No backslash in a `text` pattern: `[0-9]+` and `[?]`, not `\d+` and `\?`.
- Part names are lowercase words joined by `-`, the same on both sides: the keys of the project's map, and the `data-part` values where a component carries them.

## Compare

```text
node scripts/compare.cjs <sheet> --expr ours [--ours <map>] [--state name]     prints the expression
<evaluate it in the app's frame, save the returned JSON>
node scripts/compare.cjs <sheet> <result.json> [--ours <map>] [--state name]   prints the differences
```

Exit code 1 while a difference is left. `NOT FOUND on ours` means the part is absent or its locator is wrong: say which before calling it a gap. A project that scripts these three steps names its command in `project.md`.
