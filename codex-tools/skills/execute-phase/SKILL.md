---
name: execute-phase
description: Use when the user has a docs/plans/PLAN-*.md from plan-project and wants Codex to execute the next phase or a specified phase/task. Complete one phase per invocation, keep docs/progress/PROGRESS.md current, run local verification and a Codex-native phase-end review bundle, update checkboxes, archive progress, then stop.
---

# Execute Phase

You are the phase implementer and reviewer. Execute one phase per invocation, then stop.

Unlike the Claude version of this workflow, do not assume access to `everything-claude-code`, Claude slash commands, or model routing. Use Codex's normal repository editing tools, local test/build/lint commands, and review discipline. Spawn subagents only when the user explicitly asks for delegation or parallel agent work.

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
- Do not commit unless the user explicitly asks for commits.
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

## Phase-End Review Bundle

At the end of the confirmed scope, review the phase diff before marking it complete. Since there is no `everything-claude-code` equivalent for GPT/Codex, perform this Codex-native review bundle:

1. Code review
   - Inspect the changed files and relevant call sites.
   - Lead with bugs, regressions, broken contracts, missing tests, and maintainability risks.
   - Use file and line references.

2. Security review
   - Check auth and authorization boundaries.
   - Check input validation, injection risks, path traversal, secrets, logging of sensitive data, unsafe deserialization, and destructive operations.
   - For frontend work, check XSS and unsafe HTML/script handling.
   - For dependency changes, check whether new packages are necessary and pinned consistently with the project.

3. Functional coverage review
   - Extract each planned requirement from the phase tasks.
   - Verify implementation evidence.
   - Verify tests have meaningful assertions.
   - Return PASS only if every required behavior is implemented and tested, or if the user explicitly accepts an untested risk.

4. Verification commands
   - Run the smallest relevant lint, typecheck, build, and test commands.
   - If a command cannot run, record the exact reason.

## Review Output

If issues are found, present them in this format and ask the user which to fix:

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
3. Move `docs/progress/PROGRESS.md` to `docs/archive/PROGRESS-<phase-id>-<YYYYMMDD>.md`.
4. Tell the user: `Phase <N> complete. Ask Codex to run execute-phase to continue with the next phase.`
