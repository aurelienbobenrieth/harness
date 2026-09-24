---
name: git
description: Prepare cohesive commits, resolve branch conflicts, and produce reviewable pull requests while preserving existing work. Use when staging, committing, changing git history, or managing a PR; a code change alone does not require creating a commit or PR.
---

# Git

Make the requested history change while preserving unrelated work and the user's existing identity, signing, hooks, and branch policy.

## Inspect before changing state

Read the current branch, `git status --short`, `git diff`, and `git diff --cached`. Distinguish this task's changes from existing staged and unstaged work. Inspect the relevant base and branch diff before writing a commit or PR description.

Stage explicit paths with `git add -- <paths>` or selected hunks. A path can contain unrelated edits, so inspect the resulting staged diff as well. Preserve existing staging; use an isolated worktree or narrowly scoped operation when sharing the index would mix ownership. Never quietly include the user's pre-existing staged work in a task commit.

Keep one independently understandable change per commit. Include its tests, documentation, and required changeset together. Split unrelated refactors or behavior changes when each remains meaningful on its own; splitting a fix from its regression test usually weakens the commit.

## Commit accurately

Follow the repository's commit convention. For Conventional Commits, use `type(scope): description`, with optional scope and `!` for a breaking change. Derive the title from the final diff. Add a body for motivation or a tradeoff the diff cannot explain, and use issue-closing language only when the change resolves that issue.

Read the configured author identity before committing and retain it. Preserve configured signing and hooks. Follow any repository or user attribution requirements without inventing an author or trailer.

If a hook fails, inspect status and hook output before retrying. A failed commit attempt often created no commit; do not accidentally amend an earlier commit. Fix the cause, review any hook edits, and repeat the intended operation. Do not bypass the gate to produce a success claim.

## Branches and conflicts

Honor the requested workflow and existing authorization. Routine inspection, reversible preparation, and conflict resolution needed for that workflow do not require repeated permission. Resolve conflicts by preserving the intended behaviors from both sides, then run the affected checks. Ask when competing business behavior cannot be inferred from the code or request.

Before an operation that would discard work or rewrite shared history, identify the exact refs and files affected and whether that effect is already authorized. Preserve recoverable state where practical. Request only missing authorization, with the concrete loss or shared-history effect explained. A command's name alone does not determine whether it loses work: unstaging a reviewed task hunk differs from discarding a worktree.

When an authorized force update is necessary, use a lease bound to the remote revision inspected and stop if that revision changed. Do not repeatedly fetch and retry until somebody else's update is overwritten. Respect repository restrictions on protected branches.

## Pull requests

Read the PR template and prepare the complete local result before any missing publication authorization. The user's task determines whether commit, push, PR creation, merge, or release is included. Permission for one operation does not automatically include every later operation. Existing authorization remains valid; explicit no-publish or no-deploy constraints remain binding.

### Descriptions carry only what the diff and CI can't

A PR description follows the [communication skill](../communication/SKILL.md). **Past 100 lines nobody reads it**; most need a fraction of that, and a small fix needs two lines.

| Include                                                           | Leave out: the reader already has it                   |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| line one: problem → resulting behavior                            | file-by-file change lists, restated code (the diff)    |
| why, and the consequential choice over its alternative            | commit-by-commit narration (the log)                   |
| what the reviewer must decide or check by hand                    | check results CI reports, routine test-plan checklists |
| risks, limits, migration, checks CI doesn't run (manual, network) | recaps, empty template sections, private notation      |

Show instead of tell when it's shorter: a before/after, a behavior `diff`, a flow for a changed lifecycle, a table for compared options. Keep the description true as the branch changes; rewrite it rather than appending.

For multiline titles, bodies, or comments, prefer structured tool arguments. With `gh`, write the exact body to a temporary file and use `--body-file`; do not interpolate user content into shell code. Discover the correct remote and base rather than assuming `origin` or `main`.

After an authorized mutation, verify the actual commit, branch, or PR state. Report the resulting revision or link and distinguish local validation from pending remote checks. Remove only temporary files created for the task.
