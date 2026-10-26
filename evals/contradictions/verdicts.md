# Confirmed and dismissed contradiction flags

Audited against `origin/steering/economy` at `859ce73`. No skill text changed.

- `skills/build/SKILL.md:19` / `skills/build/SKILL.md:24`: **false positive**.
  The explicit covered, low-impact, reversible-edit exception specializes the general
  red-first loop; it still requires scoped checks. It does not require both actions
  in the same situation. Optional clarification: label it "Exception to step 2".
- `skills/build/SKILL.md:37` / `AGENTS.md:109`: **real scope ambiguity**.
  AGENTS requires a green full gate before _any_ work is done; build restricts a
  local full gate to the final pre-PR state, or CI when the project specifies it.
  A completed code task without a PR has no explicit allowed local gate point.
  Suggested fix: state "Run scoped checks while iterating; require the full gate
  once on the final changed state before handoff, or rely on CI when the project
  delegates it there" in both policies. Discussion-only tasks need no gate.
- `skills/build/SKILL.md:37` /
  `C:/Users/aurel/Documents/root/projects/keepcart/app/AGENTS.md:68`: **false positive**.
  Keepcart explicitly assigns its full gate to CI and specifies scoped local checks.
  Build explicitly permits CI "when the project says so"; its maximum is not a
  mandatory local invocation. Follow Keepcart's scoped commands.

The soft red/green flag (build lines 19/20) is also compatible: write the failing
expectation in red, keep it unchanged while implementing green.
