# Score

`/shopify-pattern score <component | section | page | route | app>`. It judges and changes nothing until the owner picks findings.

A score given without the admin's values beside our screen is an impression: measured on blind runs, it came out one point too high on average and up to three on a single screen, for a judge with references too. No compare on an element, no score for it.

## Steps

1. **Scope.** Resolve the target to files and a route in the running app (`project.md` says how to open it). Ambiguous: ask once.
2. **Inventory by intent,** from the running screen: each element, what the merchant learns there and does next. A page includes every modal, popover and flow it starts.
3. **Match.** Search the catalog, read only the matching entries and their `Not when` neighbours. An entry exists and ours has another shape: a pattern finding. No entry: research and write it first. Never score against a guess or against our own component.
4. **Compare.** For each element whose entry is marked `[sheet]`: run the compare (step 6 of the loop), once per state, in every variant `project.md` lists that changes the screen. No sheet: measure the admin first ([sheets](sheets.md)). Then click every control and walk each flow. What no compare ran on, or a state nobody exercised, is `not checked`, never passing.
5. **Anchor.** When the project has a `calibration.md`, name the nearest case in it and what differs.
6. **Report, then stop** and ask which findings to fix. Approved fixes go through the loop, one finding at a time; score again and show before and after.

## Verdicts

Each element gets one: `iso` (the compare prints 0 differences), `measured gap` (only the compare sees it), `visible gap` (seen at a glance), `broken` (does not work or shifts the layout), `wrong pattern` (the admin uses another shape for this intent), `not checked`.

The score runs from 1 (the owner would not ship it) to 5 (ships as is), with caps:

| Found in the scope                                                                   | Score at most           |
| ------------------------------------------------------------------------------------ | ----------------------- |
| a `wrong pattern`, a `broken`, a visible layout bug, or wording meant for developers | 2                       |
| anything `not checked`                                                               | 3, marked `provisional` |
| every element checked, states and flows included, all `iso`                          | 5                       |

A finding needs a fact a merchant could see and an admin place that does it differently. Without one it is a remark, listed apart, with no effect on the score. Score how things are presented, not which settings or data exist. A `NOT FOUND on ours` line is a finding only once the part is confirmed absent. A gap recorded as an owner decision in `components.md` is reported once as `by decision`.

## Report

```text
Score: 3/5 provisional (page /leaks/save20); checked 7 of 9 elements; nearest calibration: "Notes as a comment box above the timeline", owner 4, ours lacks the icon tools; biggest win: the bulk bar pills
# | Element | Ours | The admin does | Entry (sheet) | Verdict | Fix | Effort
1 | Row delete | trash icon in each row | select rows, bulk bar, confirm | index.bulk-bar (2026-11-16) | wrong pattern | bulk bar and delete flow | M
Not checked: <elements, with the failed call or the reason>
Already native, do not touch: <elements>
Write-back: <entry ids> | none
```

The first line and the columns are fixed, findings worst first. `Ours` and `The admin does` quote the compare's line when there is one. `Fix` names the component from `components.md` or the composition from the kit's recipe. `Effort` is for an agent: S under an hour, M half a day, L more. "Roast" means no softening, not exaggeration.

| Scope         | Report                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Component     | one table over all its states and variants, and the screens where each gap shows; one score        |
| Section       | its elements in their page (heading, spacing, neighbours); one score, no page score                |
| Page or route | one table grouped by section, with the flows it starts and each variant that changes it; one score |
| App           | a page, not a message: see below                                                                   |

## App report

No app average: a mean hides the screen that would be rejected. Write the results as JSON and build the page with `node scripts/report.cjs results.json out.html` (format at the top of the script), then publish it as a web page when the host can. It shows, in this order:

1. The distribution: how many routes at 5, 4, 3, 2, 1 and not checked.
2. **Fix once, gains on several routes:** each finding that comes from a shared component, with the routes it touches.
3. One line per route, worst first: score, elements checked out of total, its worst finding. Each line opens to that route's full table, the same as the page report, with our capture and the admin's side by side.

A route not run is `not checked`.

Write back to the project folder, in the same pass, what scoring taught: a component's status in `components.md`, a map in `ours/`, a state or a nuance the admin showed, a new case in `calibration.md` when the owner gives a score.
