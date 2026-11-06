---
name: build
description: Writes and changes code and tests for the most value from the least code. Use when implementing a feature, fixing a bug, refactoring, or writing tests.
---

# Build

Judge the result, not the steps. Done: everything asked works, nothing unasked exists, and no line could go without losing behavior. There is no required order.

## Code

- Smallest code that fully does the job. A need that is not here today gets nothing: no option, layer, factory or generic for one caller.
- Before writing, look for what already does this. Use it when both will evolve together; duplicate when coupling them makes no sense. KISS and YAGNI outrank DRY.
- Existing code is evidence, not a standard. Match its conventions, never copy its defects (swallowed errors, null for failure, float money), and leave unrelated legacy alone.
- Nothing implicit: no silent default, fallback, coercion or swallowed error. A failure stays explicit and reaches someone who can act. Check what the spec refuses and what arrives from outside the system. A caller breaking a stated contract gets no guard and no test.
- Spend care where change is slow. Internals may stay plain. Exports, stored data, wire formats and anything many callers share: expose the least a caller needs, name it for that caller, think through failure and evolution first.

## Tests

- A test reads top to bottom as a short story in the words of the spec: a state, one use of the public entry, an observable outcome, one named step per line. No loop, condition, computed name, mutation or data table. A project's story API is that form where it exists; plain tests are enough elsewhere. No framework is invented for form's sake.
- A reader who knows the spec, not the code, follows a story without leaving it. What makes this story differ, and its expected outcome as a literal from the spec, stay visible in it, never behind a positional argument or a recomputation. Setup repeated across stories goes in a small builder that defaults what the story ignores and takes what differs by name, so each step stays one short line.
- One behavior per story, named for it: the success path, each refusal, each boundary, each named defect the spec promises. Nothing unpromised: helpers, call order, wording, unspecified inputs.
- Every story catches a defect no other catches, or it is absent.
- Plain examples are the default. A wider means appears only for the failure it fits: a property for a wide input space, a contract at a module boundary, a model for state over time, end to end for real wiring, mutation or proof for money or security.

## Finish

Reread the diff once, as a reviewer paid to delete. Remove what carries no behavior. Then stop.
