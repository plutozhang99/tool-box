# Start a Project — Reference Guide

> **TL;DR**: Use `/start-project {path}` to activate the full CTO orchestration workflow.
> The executable rules live in `skills/start-project/SKILL.md`.

---

## What This System Does

When you invoke `/start-project {path}`, Claude acts as **CTO**: reads the spec, plans, verifies with you, then orchestrates sub-agents autonomously — with mandatory review, git milestones, and a live progress file for context recovery.

---

## Initialization Prompt (manual fallback)

If not using the skill, paste this to begin:

```
1. Read {path} — identify what it is and what task it requires
2. Outline your implementation plan
3. Review the plan internally
4. Re-plan and refine
5. Do not write any code — ask me targeted questions to verify key details
6. You may use an orchestrator agent for planning only (no coding),
   with sub-agents assigned per task
```

---

## Model Assignment

| Role | Model | Notes |
|------|-------|-------|
| CTO / Orchestrator | `sonnet` | You |
| Coding sub-agents | `sonnet` | **Haiku banned for production code** |
| Standard review | `sonnet` | code + security + functional |
| Architecture / planning | `opus` | PRD, system design, major decisions |
| Security review (sensitive) | `opus` | auth, crypto, payments, PII |
| Escalated review (Round 3+) | `opus` | When Sonnet cycles fail |
| Documentation agent | `haiku` | Safe — no production code |
| Git commit agent | `haiku` | Commit messages only |
| Codebase search | `haiku` | Read-only exploration |

---

## Review Protocol

After **every** sub-agent delivery, run 3 reviews in parallel:

1. **code-reviewer** (sonnet)
2. **security-reviewer** (sonnet / opus for sensitive modules)
3. **functional-coverage** (sonnet) — `/functional-coverage` skill

If Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) is enabled, spawn a review team instead.

### Escalation (3-round cap)

| Round | Action |
|-------|--------|
| 1 | Sub-agent fixes issues |
| 2 | Sub-agent re-reviews + targeted fix |
| 3 | CTO decides: accept risk / rearchitect / Opus arbitration |

Round 3 decision must be recorded in `docs/progress/PROGRESS.md`.

---

## Agent Tool Isolation + Turn Limits

| Agent | Tools | Max Turns |
|-------|-------|-----------|
| Coding | Read, Edit, Write, Bash, Glob, Grep | 30 |
| Review | Read, Glob, Grep (read-only) | 10 |
| Planning | Read, Glob, Grep, WebSearch | 10 |
| Doc | Read, Write, Edit, Glob, Grep | 15 |
| Git | Bash (git only), Read | 5 |

---

## Progress File

`docs/progress/PROGRESS.md` must always be current. It's the recovery document if context resets.

Required sections:
- **Project / Phase / Active Task**
- **Completed Tasks** (with commit hash + review status per task)
- **Pending Tasks** (prioritized)
- **Review Log** (per task: code / security / functional / rounds / result)
- **Key Decisions & Accepted Risks**
- **Next Agent Prompt** (self-contained, ready to paste)
- **Context Budget** (% used — stop new multi-file tasks at 80%)

---

## Git Commits

- Triggered by CTO via git-agent (haiku) after each milestone
- Only after all reviews PASS (or escalation formally recorded)
- Format: `<type>: <description>` (conventional commits)

---

## Autonomous Operation

CTO operates without user approval between steps — except:
- Phase 0: before any code is written (user must confirm plan)
- 80% context: checkpoint + progress file update
- Round 3: CTO decision required

---

## Skills in This System

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `start-project` | `/start-project {path}` | Full CTO orchestration workflow |
| `functional-coverage` | `/functional-coverage` | Feature completeness + test coverage check |

Install globally:
```bash
ln -s ~/Documents/tool-box/claude-code-tools/skills/functional-coverage ~/.claude/skills/functional-coverage
ln -s ~/Documents/tool-box/claude-code-tools/skills/start-project ~/.claude/skills/start-project
```
