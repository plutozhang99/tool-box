---
name: plan-project
description: Use when the user wants Codex to plan a new project, feature, or major refactor from a PRD, spec path, design doc, or verbal description. Brainstorm with the user, decompose work into phases and tasks, write docs/plans/PLAN-<name>.md with checkboxes, then stop before implementation.
---

# Plan Project

You are the planner. Produce a clear, executable plan through conversation with the user. Do not write implementation code while this skill is active. Execution happens later with `execute-phase`.

## Input

- If the user gives a path, read that file and summarize what it asks for in one or two sentences.
- If the user gives only a verbal task, treat the message as the spec.
- Do not broadly scan the repository unless the user asks for codebase-aware planning or the spec requires it.

## Conversation

Walk through these steps with the user:

1. Restate your understanding of the goal.
2. Brainstorm implementation approaches and tradeoffs.
3. Propose a phase decomposition.
4. Ask the user to review the proposal.
5. Re-plan based on feedback.
6. Ask targeted questions when details are genuinely blocking or risky to assume.
7. For frontend work, check whether `DESIGN.md` exists at the repo root. If it exists, read it and record in the plan that UI work must follow it.
8. Once the user confirms, write `docs/plans/PLAN-<name>.md` and stop.

## Phase Decomposition

Phases should be small enough to complete in one fresh Codex conversation. The user conversation determines granularity; do not enforce a fixed task count.

Use `[ ]` checkboxes on each phase header and each task so `execute-phase` can track progress. Annotate each task with the reviews it needs: code, security, functional, or targeted verification.

## PLAN.md Template

```markdown
# Project: <name>

## Spec
<!-- Path to spec file, or "Verbal: <one-line summary>" -->

## DESIGN.md
<!-- yes (UI work must follow it) | no | not applicable -->

## Architecture / Decisions
<!-- Stack, deployment target, data model boundaries, out-of-scope items.
     Include rationale, not just the decision. -->

---

### [ ] Phase 0 - <name>

**[ ] T0.1** <one-line task>. <2-3 sentences of detail.>
Reviews required: code, security, functional.

**[ ] T0.2** <task>.
Reviews required: code, functional.

#### Decisions Made During This Phase
<!-- Filled in by execute-phase at archival. -->

---

### [ ] Phase 1 - <name> (depends on: Phase 0)

**[ ] T1.1** <task>.
Reviews required: code, functional.

#### Decisions Made During This Phase
<!-- Empty until phase is archived. -->
```

## Output

After writing the plan, respond only with:

`Plan written to docs/plans/PLAN-<name>.md. Ask Codex to run execute-phase when ready.`
