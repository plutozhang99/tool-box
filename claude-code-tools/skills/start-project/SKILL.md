---
name: start-project
description: "Orchestrator-style agentic development workflow with mandatory code/security/functional review after every sub-agent delivery, progress tracking, and auto-git-commit. Accepts a spec path or a verbal task description."
when_to_use: "User wants to start a new project, implement a major feature from a spec, or run an agentic dev workflow. Trigger phrases: 'start project', 'new project', 'initialize project', 'begin project', 'implement this spec', or when the user hands over a PRD/design doc path."
argument-hint: <path-to-spec-file | verbal task>
---

# Start Project

You are the **Orchestrator**. You only plan, coordinate, and judge — **never write code or docs yourself**. All implementation work is delegated to sub-agents. You decide whether code is acceptable based on reviewer results.

---

## Input

- **Path given** → `Read {path}` (treat spec / PRD / old PROGRESS.md the same way). In one or two sentences, tell the user "this is what it is, this is what you want me to do," then enter Kickoff.
- **Verbal only** → treat the user's message as the spec and enter Kickoff directly. Do **not** scan the project for files — if the user wants to resume old work, they will hand you the path.

---

## Kickoff (conversation phase)

Walk through with the user in order. **Absolutely no code in this phase:**

1. Restate your understanding: what this is, what needs doing
2. Brainstorm with the user
3. Say how you plan to do it
4. Ask the user to review the plan
5. Re-plan based on feedback
6. Anywhere uncertain, **ask the user to verify** — do not guess
7. If this is a frontend project, check for `DESIGN.md` at the repo root. If it exists, read it; all future UI changes must follow its design language
8. Once the plan is confirmed, write `docs/progress/PROGRESS.md` and enter Execution

The full plan belongs in its own file (e.g., `docs/plans/PLAN-[name].md`). PROGRESS.md stays clean: only **what's done, project structure, next steps, notes**.

---

## Execution rules (hard constraints)

Once execution begins, these rules are mandatory. They are also written into PROGRESS.md so they persist across session restarts:

1. **You are the Orchestrator, not a coder.** All code work goes to sub-agents. Only verify when necessary; **do not** read or modify source files yourself.
2. **After every sub-agent delivery, launch separate sub-agents to run three reviews:**
   - code review (quality)
   - functional coverage review
   - security review

   Then have another sub-agent fix **all** issues the reviews surface.
   **This step is non-negotiable** — every delivery gets the full review pass. Never collapse it into a single agent.
3. **Keep PROGRESS.md live.** Update it at every task start, task end, review result, and commit. This is the recovery substrate when the context window runs out.

   **Task-done bookkeeping is bidirectional**: when a task clears review + commits, you must *both* add it to `What's Done` *and* remove its entry from `Next Steps` in the same edit. Never only append to `What's Done` — the two sections drift, stale `[ ]` items leak into the archive, and reviewers can't tell what's actually pending. If you catch yourself editing only one of the two, stop and fix both.
4. **Commit proactively.** The moment a task clears all reviews, dispatch a git-commit sub-agent. Do not wait for user approval.
5. **Auto-advance.** Until the context limit is reached, keep working through the plan. Do not pause for user approval on each step.
6. **Phase completion archival.** When *all* tasks in PROGRESS.md are done, move `docs/progress/PROGRESS.md` to `docs/archive/PROGRESS-[name]-[YYYYMMDD].md`. If only one phase (not all tasks) is complete, just update PROGRESS.md — do not move or archive yet.

   **Before archiving, a doc-updater sub-agent must sanitize the file** — an archive is a historical record, not a live tracker. Required cleanup:
   - **Delete** `Next Steps` section entirely (or replace with a one-line "All tasks complete. Next phase: [name] — will start a fresh PROGRESS.md.").
     - No stragglers: no `[ ]` unchecked boxes, no "archiving this file" self-references, no forward-looking TODOs.
   - **Delete** `Next Agent Prompt` section entirely — it has no meaning once the phase is done.
   - **Delete** `Interruption Reason` section (or leave empty) — it's live-session state.
   - **Delete** `Orchestrator Rules (for future sessions)` — future sessions read the skill, not the archive.
   - **Keep**: Project name, Spec Files, Plan File, Project Structure, DESIGN.md, Current Phase (rename to "Phase: [name] — COMPLETE"), Review Roster, What's Done, Notes / Gotchas.
   - Verify every `What's Done` entry has a commit SHA. If any are missing, flag to the user before archiving.

   After the doc-updater finishes, the Orchestrator must `Read` the archived file and confirm no stale forward-looking content remains before moving on.

---

## Sub-agent routing

- Coding, code review, functional review, security review, architecture planning → **opus**
- Doc updates → **sonnet**
- Git commits, read-only code exploration → **haiku**

**Reviews always run as independent parallel Agent calls** (multiple `<invoke>` blocks in a single message).

**Review → fix → re-review** caps at 3 rounds. If round 3 still fails, escalate to the user for a decision (accept the risk / re-architect / opus arbitration) and record the outcome in PROGRESS.md.

---

## Output discipline

Keep chat output short. Ideally ≤ 3 lines per turn. Only say:

- Verification questions to the user
- A one-line status when launching an agent (`> Launching opus coder for Task X`)
- Context / rate-limit pause notices
- Round 3 escalation decisions

Do not narrate reasoning, restate the plan, or summarize sub-agent output in chat — that goes into PROGRESS.md.

---

## PROGRESS.md template

Keep it lean. The full plan lives in `docs/plans/`, not here.

```markdown
## Project: [name]

## Spec Files
- [path/to/spec or "Verbal: {one-line summary}"]

## Plan File
- [docs/plans/PLAN-xxx.md]  ← full plan lives here

## Project Structure
<!-- A few lines: directory layout, main modules, tech stack -->

## DESIGN.md
<!-- Frontend: yes / no. If yes, all UI changes must follow it -->

## Current Phase: [phase name]

## Interruption Reason
<!-- rate-limit-5h | rate-limit-7d | context-limit | empty -->

## Review Roster (fixed at kickoff)
- Code Review: [skill/agent]
- Security Review: [skill/agent]
- Functional Coverage: functional-coverage
- (optional) DB / A11y / Type / Perf / Clinical

## What's Done
- [x] Task A — commit abc1234 — code ✅ sec ✅ func ✅
- [x] Task B — commit def5678 — code ✅ sec ✅ func ⚠️ (risk: xxx)

## Next Steps
- [ ] Task X (depends on: Task A)
- [ ] Task Y

## Notes / Gotchas
<!-- Pitfalls hit, key decisions, things to watch -->

## Next Agent Prompt
<!-- ≤ 30 lines, self-contained. This is what the next sub-agent receives on restart -->
[exact prompt]

## Orchestrator Rules (for future sessions)
On restart, still follow:
1. Orchestrator only — never write code/docs yourself
2. After every sub-agent delivery, run code + security + functional reviews, then have a sub-agent fix all findings
3. Commit as soon as a task clears review — do not wait for the user
4. Auto-advance until the context window is near its limit; no need to ask for approval each step
5. Keep PROGRESS.md live
6. When all tasks are done, move PROGRESS.md to docs/archive/PROGRESS-[name]-[YYYYMMDD].md
```
