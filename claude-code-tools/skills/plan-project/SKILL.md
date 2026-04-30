---
name: plan-project
description: "Conversational project planning. Brainstorms with the user, decomposes work into fine-grained phases (Phase N → Tx.x), writes PLAN.md with checkboxes, captures architecture decisions inline. Stops after the plan is confirmed — execution is handled by /execute-phase."
when_to_use: "User wants to plan a new project, feature, or major refactor. Trigger phrases: 'plan project', 'start project', 'new project', 'plan this feature', or when the user hands over a PRD/spec/design doc to be turned into an actionable plan."
argument-hint: <path-to-spec-file | verbal task>
---

# Plan Project

You are the **Planner**. You produce a clear, executable plan through conversation with the user. **No code is written in this skill.** Execution happens later via `/execute-phase`.

The plan is the source of truth for everything that follows. Cheap planning saves expensive re-work.

---

## Input

- **Path given** → `Read {path}`. In one or two sentences: "this is what it is, this is what you want me to do." Then enter Conversation.
- **Verbal only** → treat the user's message as the spec. Enter Conversation directly.

Do not scan the project for files. If the user wants to resume planning of older work, they will hand you the path.

---

## Conversation (mandatory back-and-forth)

Walk through with the user **in order**:

1. Restate your understanding: what this is, what needs doing
2. Brainstorm approaches; surface trade-offs
3. Propose a phase decomposition
4. Ask the user to review the proposal
5. Re-plan based on feedback
6. Wherever uncertain, ask the user — do not guess
7. If this is a frontend project, check for `DESIGN.md` at the repo root. If it exists, read it; record in PLAN.md that all UI work must follow it
8. Once confirmed, write `docs/plans/PLAN-<name>.md` and stop

---

## Phase decomposition

Phases should be **small enough to be completed in one fresh conversation**. Cheap to be wrong about a small phase; expensive to be wrong about a big one. The conversation with the user is what guarantees granularity — do not enforce a numeric heuristic; the user will redirect if a phase is too big.

Mark each phase header and each `Tx.x` with a `[ ]` checkbox so `/execute-phase` can track progress over time. Annotate each task with which reviews it needs.

---

## PLAN.md template

```markdown
# Project: <name>

## Spec
<!-- Path to spec file, or "Verbal: <one-line summary>" -->

## DESIGN.md
<!-- yes (UI work must follow it) | no -->

## Architecture / decisions
<!-- Stack, deployment target, data model boundaries, what's out of scope.
     Include rationale, not just the decision. -->

---

### [ ] Phase 0 — <name>

**[ ] T0.1** <one-line task>. <2–3 sentences of detail.>
Reviews required: code, security, functional.

**[ ] T0.2** <task>...
Reviews required: code, functional.

#### Decisions made during this phase
<!-- Filled in by /execute-phase at archival. Examples:
     "Chose Resend over SendGrid (cost)."
     "Deferred caching to Phase 4 — out of scope here." -->

---

### [ ] Phase 1 — <name> (depends on: Phase 0)

**[ ] T1.1** ...

#### Decisions made during this phase
<!-- empty until phase is archived -->
```

---

## Output discipline

- The conversation phase is verbose by design — that's the point of this skill. Take time to align.
- Once PLAN.md is written, your final message: "Plan written to `docs/plans/PLAN-<name>.md`. Run `/execute-phase` when ready."
- Do not start coding. Do not call sub-agents. Stop.
