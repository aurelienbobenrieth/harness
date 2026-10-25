# Test strategies

Load when picking a strategy. Rows are common fits, not the only ones; each strategy past examples needs a reason example tests can't cover.

## Failure to strategy

| Failure you fear | Strategy | Signals |
| --- | --- | --- |
| a law broken on unlisted inputs | bounded property; keep seed + shrink path | `property-test-opportunity` |
| bad sequences: retry, cancel, duplicates | state model simpler than the code | `temporal-coupling` |
| fake drifting from the real boundary | one contract suite, fake and real | `fake-parity`, `integration-test-owns-its-boundary` |
| broken install or public import | packed artifact in a clean consumer | none |
| race between concurrent operations | controlled, replayable interleavings at the real boundary | none |
| step 2 of 3 fails, half-written state | fault at the boundary, state asserted after | `no-swallowed-failure` (effect) |
| last release's data no longer reads | old-format fixtures, migration run on them | `persisted-snapshot-compat` (xstate) |
| wrong role/tenant gets through | negative cases: wrong role, other tenant, expired session | none |

## Notes

- **Properties:** real laws only; define valid domain + relation before the generator; keep seed + shrink path; found failure becomes a named example.
