# Report

The final message of any pass that touched UI starts with this block. The first and last lines and the columns are fixed; one row per element and state.

```text
Admin: not opened, sheets fresh | opened: Orders > #1044, 2026-11-16 | not opened: <the failed call and its error>
Element | Entry | Sheet (measured) | Compare | Differences left
Timeline | detail.timeline | 2026-11-16 | 8 parts, 18 values | none
Bulk bar | index.bulk-bar | 2026-11-16 | 7 parts, 15 values | more: not found (one action, no overflow menu)
Notes list | detail.timeline-comment | none: not reached | not run | unknown
Write-back: detail.timeline (map, components.md) | none, nothing learned | blocked: <reason, proposed text below>
Questions asked: 3, before building
```

An element is compared only when the compare ran on it in this pass. Screenshots side by side, a memory of the admin, a neighbour screen or the entry's text are `not run`. An element with differences left, or not run, is not done: say so in the first sentence after the block.
