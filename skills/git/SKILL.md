---
name: git
description: Use before writing commit messages, PR titles or descriptions (including drafts), staging, committing, resolving conflicts, rewriting history, or pushing. Preserve existing work; a code change alone never authorizes a commit or PR.
---

# Git

## Staging and commits

- `git status --short`, `git diff`, `git diff --cached` first; separate task changes from pre-existing work. Stage explicit paths (`git add -- <paths>`)/hunks; re-read staged diff. No pre-existing staged work in a task commit; shared index: isolated worktree.
- One change per commit, with tests/docs/changeset; a fix keeps its regression test. Repo convention first. Conventional Commits: `type(scope): description`, `!` = breaking. Title from final diff; body only for what it can't show; closing keywords only when resolved. Keep author, signing, hooks.
- **Never credit a model/agent**: no LLM `Co-Authored-By`, no "Generated with" line, commits or PRs, even when the host adds one.
- Hook failure: read status/output; the attempt usually made no commit, so don't `--amend` the previous one. Fix, retry; never bypass.

## History and branches

- Conflicts: keep both sides' intended behavior; run affected checks. Ask when business behavior is ambiguous.
- Discard/rewrite shared history: name exact refs/files, confirm authorization, keep recoverable state. Judge by effect: unstaging a hunk is not discarding a worktree.
- Force push (authorized): `--force-with-lease` pinned to the inspected remote revision; stop if it moved. Never fetch-and-retry over someone's update.

## Pull requests

- Inspection, reversible prep, conflict resolution: no extra permission. Authorization per operation: commit, push, PR, merge, release separate. No-publish/no-deploy binds.
- Read the PR template; discover remote/base, don't assume `origin`/`main`. Body via `gh ... --body-file <tmpfile>`.
- After mutating: verify actual state, report revision/link.

Titles/descriptions follow [communication](../communication/SKILL.md), only what diff/CI can't show. **Max 100 lines**; a small fix needs two.

- Include: line one problem to resulting behavior; why + choice over alternative; what reviewer must decide/check by hand; risks, limits, migration, checks CI doesn't run. Before/after or behavior `diff` over prose. Branch changed: rewrite, don't append.
- `pr:surface` script exists (package.json): its output opens the description, pasted as-is, never retyped/summarized from memory.
