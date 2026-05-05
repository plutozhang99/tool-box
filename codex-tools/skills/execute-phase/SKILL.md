---
name: execute-phase
description: Use when the user has a docs/plans/PLAN-*.md from plan-project and wants Codex to execute the next phase or a specified phase/task. Complete one phase per invocation, keep docs/progress/PROGRESS.md current, run local verification, use phase-review for the phase-end review, update checkboxes, commit, push to GitHub, archive progress by plan, archive completed plans, then stop.
---

# Execute Phase

You are the phase implementer. Execute one phase per invocation, run the `phase-review` skill for the phase-end review, commit and push the completed phase, then stop.

Unlike the Claude version of this workflow, do not assume access to `everything-claude-code`, Claude slash commands, or model routing. Use Codex's normal repository editing tools, local test/build/lint commands, and the local `phase-review` skill. Spawn subagents only when the user explicitly asks for delegation or parallel agent work.

## Startup

1. Find `docs/plans/PLAN-*.md`. If multiple exist, ask which plan to use. If none exists, tell the user to run `plan-project` first and stop.
2. Check for `docs/progress/PROGRESS.md`.
   - If it exists, read it and resume from the active task after confirming with the user.
   - If it does not exist, choose the first unchecked phase unless the user specified a phase or task.
3. Summarize the selected phase, tasks, and important decisions to watch.
4. Ask for kickoff confirmation. The user may narrow scope, such as "only T2.1" or "stop after T2.3".
5. Create or refresh `docs/progress/PROGRESS.md`.

## Execution Rules

- Work through the confirmed task scope without pausing for routine approval.
- Prefer the repository's existing patterns, helpers, and tests.
- Keep edits scoped to the phase.
- Update `docs/progress/PROGRESS.md` after meaningful milestones and before any risky context boundary.
- Use local verification commands appropriate to the project. If there is no obvious command, inspect package files or docs to identify one.
- Commit and push only after the confirmed scope passes review or the user accepts remaining risk.
- Do not include unrelated user changes in the commit.
- Do not start the next phase.

## Progress File

Keep `docs/progress/PROGRESS.md` lean:

```markdown
# Phase <N> - <name> (active)

> Source: ../plans/PLAN-<name>.md

## Status
- Started: <YYYY-MM-DD HH:MM>
- Last update: <YYYY-MM-DD HH:MM>
- Interruption: none | context-limit | user-paused | environment-blocked

## Sub-task Progress
- [x] T<N>.1 - <name>
- [ ] T<N>.2 - <name> (in progress)
- [ ] T<N>.3 - <name>

## Session Notes
<!-- Terse notes for non-obvious implementation decisions and blockers. -->

## Restart Prompt
<!-- Self-contained restart prompt, <= 30 lines. -->
```

Batch progress edits. Do not rewrite the file after every minor action.

## Phase-End Review

At the end of the confirmed scope, use the `phase-review` skill before marking the phase complete.

Provide `phase-review` with:

- The active `docs/plans/PLAN-*.md` phase and task scope.
- The current diff for the phase.
- Verification commands already run and their results.
- Any known implementation decisions, skipped tests, or environment blockers from `docs/progress/PROGRESS.md`.

Let `phase-review` perform the code correctness, security, functional coverage, and verification assessment. Preserve its findings-first output format.

If issues are found, present them to the user and ask which to fix:

```text
[<SEVERITY>] <file>:<line> - <one-line issue>
Why it matters: <one sentence>
Suggested fix: <one sentence>
```

Severity:

- CRITICAL: security exploit, data loss, build broken
- HIGH: correctness bug, missing auth check, major regression
- MEDIUM: weak test, brittle behavior, maintainability issue
- LOW: style or minor cleanup

Fix what the user selects. For CRITICAL and HIGH fixes, do a targeted re-review of the changed files. For MEDIUM and LOW fixes, local verification is enough unless the change is risky.

## Completion

When the confirmed scope passes review or the user accepts remaining risk:

1. Update the relevant `PLAN.md` phase and task checkboxes from `[ ]` to `[x]`.
2. Fill `Decisions Made During This Phase` with decisions and rationale discovered during implementation.
3. Derive `<plan-id>` from the active plan filename without `.md` (for example, `docs/plans/PLAN-search.md` -> `PLAN-search`).
4. Move `docs/progress/PROGRESS.md` to `docs/archive/progress/<plan-id>/PROGRESS-<phase-id>-<YYYYMMDD>.md`. Create the `<plan-id>` folder first if needed.
5. Check whether every phase and task in the active plan is now complete.
   - If the plan still has unchecked phase or task boxes, leave it in `docs/plans/`.
   - If the plan is complete, move it to `docs/archive/plans/<plan-id>-<YYYYMMDD>.md`. Create `docs/archive/plans/` first if needed.
6. Inspect `git status --short` and `git diff` to identify only the files changed for this phase.
7. Stage the phase implementation, plan update or archived completed plan, and archived progress file. Exclude unrelated user changes.
8. Commit with a concise phase-scoped message, such as `Complete phase <N>: <phase name>`.
9. Push the current branch to its GitHub remote. If no upstream is configured, push to `origin HEAD` and set upstream when appropriate.
10. If commit or push cannot complete because of auth, missing remote, branch protection, merge conflicts, or environment restrictions, leave the completed work uncommitted or unpushed as appropriate, record the blocker in the final response, and do not start the next phase.
11. Tell the user:
    - If more phases remain: `Phase <N> complete, committed, and pushed. Ask Codex to run execute-phase to continue with the next phase.`
    - If the plan is complete: `Plan <plan-id> complete, committed, pushed, and archived.`
