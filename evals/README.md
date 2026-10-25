# Measure skill consistency, routing, and incident trends

Requires Node 22.19+/24.11+, pnpm, and authenticated `codex` (judge) or `claude` (live).
Install CLI releases supporting the flags in `evals/lib/runner.mjs`; checked against local
`claude --help` / `codex exec --help`. No Opus defaults.

| Eval     | Question                                        | Command                                                  | Planning cost                           |
| -------- | ----------------------------------------------- | -------------------------------------------------------- | --------------------------------------- |
| 1        | Which steering statements conflict or repeat?   | `pnpm evals:contradictions`                              | Two judge calls, reserved at $0.75 each |
| 2 static | Do descriptions select the labeled skill?       | `pnpm evals:triggering:static`                           | One judge call, reserved at $0.75       |
| 2 live   | Does an agent actually load the right skill?    | `pnpm evals:triggering`                                  | 59 Haiku runs, reserved at $0.05 each   |
| 6        | Are behavioral incident signals falling weekly? | `pnpm evals:incidents --from 2026-10-18 --to 2026-10-26` | $0, local files only                    |

Add consumer instructions: `pnpm evals:contradictions --include /path/to/AGENTS.md`.
Repeat `--include` for files/directories; every steering file under `skills/` is read.
Both audit passes see the whole corpus to retain cross-file conflicts, with different focus.
Hard conflicts exit 1; duplicates and soft tensions are advisory. Judge citations are validated.

Live options: `--provider claude|codex --model <id> --limit <count> --case-usd <amount>`.
Resume an interrupted live run with `--resume <its.jsonl>`; prior completed cases and cost carry forward.
Defaults: `claude-haiku-5-5`, `gpt-6-luna`; judge override: `EVALS_JUDGE_MODEL`.
`EVALS_MAX_USD` defaults to $3 per command; no next call starts without its reservation.
Streaming usage stops a call when its allowance or global budget is reached.
Claude also receives `--max-budget-usd`; Codex has no CLI dollar/turn cap, so cancellation
uses observed messages/tool steps and usage. One in-flight API response can exceed the limit.
Estimates use conservative planning rates adapted from the owner's `extract.py`, not invoices; cancelled calls without usage are charged their full reservation.
Override USD/M `[input,output,cacheRead,write5m,write1h]` per model with `EVALS_RATES_JSON`.
`EVALS_CLAUDE_BIN` / `EVALS_CODEX_BIN` accept native executable paths for unusual CLI shims.

Each run writes `evals/results/<eval>/<timestamp>.jsonl` and `.md` (gitignored).
JSONL retains normalized messages, arguments, observed skill loads, usage and duration.
Keep these local: agent transcripts and included consumer instructions may contain private data.
Errors/partial runs exit 2 and retain progress; routing mismatches exit 1, perfect routing exits 0.
Precision is TP/(TP+FP), recall TP/(TP+FN); n/a means no denominator. Confusions include none.
The 59 labels describe intended tasks, independently of current skill prose. Revisit labels
when skills are added/removed. Built-in non-Harness skills can appear as confusion predictions.

Fixtures are copied into fresh temp directories and removed after each case.
Current tree skills are copied to `.agents/skills` and `.claude/skills`; `AGENTS.md` receives
verbatim core blocks and a task map, and `CLAUDE.md` imports it, per install-harness.
Reuse `runAgent({provider,model,cwd,prompt,maxTurns,timeoutMs})`, `judge`, and `fixture` for part B.
Live triggering stops at the first Skill call/read, otherwise after four CLI turns; always-on cases continue for behavioral evidence.

Incidents default to `~/.claude/projects` and `~/.codex/sessions`; `--include` overrides roots.
The interval is `[from,to)`, UTC; weeks start Monday. Rows count session files per week.
`--git /repo` adds a weekly >50% proof/docs commit heuristic; it does not establish fabrication.
Polling counts one streak of 3+ consecutive wait/sleep/status calls, reset by another tool.
Context includes cached input. T3 availability requires transcript evidence; absence is unknown.
Cache columns count tokens by explicit TTL; missing TTL is reported separately, never guessed.
Gate counts are invocations per session, not proof a gate succeeded. Partial weeks stay partial.

`pnpm test:evals` runs synthetic incident and runner regressions without credentials or spend.
CI always runs these via `pnpm check`. Model evals remain local: this repo has no judge
credentials configured in CI. With credentials, run only contradictions and static triggering
in a trusted CI job; do not run live fixtures or replay private home transcripts in CI.

## Compare skill sets with behavior and value evals

`--skills-ref <git ref>` reads the complete skills tree from that commit (without
switching the checkout); `--skills-ref none` omits Harness bodies, routing and core.
Default: working tree. Model/system instructions outside Harness remain in all conditions.
Each behavioral row records the selected ref, resolved commit, trial, normalized/raw
transcript, artifacts and deterministic rubric. Results are local and gitignored.

| Eval | Command                                                                 | Observable criterion                                                                                                                                                   |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3    | `pnpm evals:economy --skills-ref origin/skills/terse --provider claude` | Five fixed tasks: blocking 12s command, inline tiny edit, broad delegation, scoped checks then one final gate, reversible owner default                                |
| 4    | `pnpm evals:ab --tasks tiny,git --seeds 3`                              | Same tasks under current, terse and none; pass rate, tool calls, total context/output tokens, USD                                                                      |
| 5    | `pnpm evals:quality --skills-ref origin/skills/terse --provider codex`  | Five review bugs + three harmless edits (line-level recall/precision); commit/PR format; observed assertion failure before production fix and unchanged tests on green |

A/B defaults to all economy/quality tasks, three independent trials per condition;
`--tasks` limits it. Trials are repetitions tagged with seeds, not API RNG control.
Choose models with `--provider claude|codex --model <id>`. No Opus defaults.
`--case-usd` defaults to $0.15; `EVALS_MAX_USD` caps the whole command including judges.
For a matrix, allocate disjoint command caps whose sum fits the total budget; keep
probe/retry costs in the ledger. Partial runs retain completed rows and exit 2.
Behavior failures exit 1. Never treat truncation or missing evidence as success.

Writable behavioral fixtures allow CLI file/command tools (Codex full access on
Windows, where workspace-write can report read-only). They are trusted fixed local
prompts, not a sandbox for hostile inputs. No live repositories or network tasks.
Broad delegation uses a local MCP deterministic worker, not a paid child agent;
this measures the delegation decision and standalone brief, not child-model quality.
Only brief quality uses a judge. All other graders are fixed rules.
Review matching uses seeded line locations; it cannot assess finding prose quality.
Testing records command results/source/test snapshots (including direct node:test output) and independently exercises
two expected outputs; a red claim alone cannot pass. Scoped-gate evidence comes
from the fixture check command. Git checks cover Conventional Commits, result-first
PR opening, length, attribution and checklist/filler rules, not all editorial nuance.

Triggering now supports `--turns 4` (default), recording first-two versus four-step
load recall from the same transcript. Claude turns are assistant events; Codex uses
completed message/tool steps, as in the runner. Communication/economy cases have
`mode: always-on`: exclude them from load recall; report bounded/plain output and
budget/no-sleep behavior proxies separately. These proxies are weaker than the
concrete economy/quality tasks; a load is never their pass criterion.
