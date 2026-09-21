# Operating Model

How a repo steered by @aurelienbbn harness packages divides the work.

## Division of labor

```text
humans :: architecture, boundaries, verification strategy, what "good" means
agents :: implementation, proven against automated constraints,
          not against reviewer patience
```

An agent's output is trusted exactly as far as the constraint set can falsify it.

## Concern -> enforcement

```text
invalid states                         -> types and schemas (unrepresentable, not validated)
forbidden patterns                     -> oxlint rules
judgment with a deterministic trigger  -> agentlint rules + resolution ledger
structure, manifests, layout           -> conformance suites
behavior                               -> tests
whatever remains                       -> the code-review skill
```

Each concern lives at exactly one level. Enforced twice is one home too many. Enforced only in prose is not enforced.

## The promotion loop

```text
review finding recurs -> rule proposal (name the package) -> next occurrence caught by a tool
```

The review skill exists to shrink itself. A healthy harness moves concerns down the table over time, from human attention to machine enforcement.

## What human review is for

- architecture and module boundaries
- irreversible operations: migrations, deletions, releases
- security boundaries
- public contracts

Everything else is either enforced by the table above or not worth a human's attention.
