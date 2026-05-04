---
name: phase-review
description: Use when the user wants a Codex-native review of a completed phase, task, branch, or working-tree diff. Replace external reviewer skill packs by performing code review, security review, functional coverage review, and verification-command assessment in one read-only pass.
---

# Phase Review

Review the current task or phase in a read-only mode. Do not edit files unless the user explicitly asks for fixes after seeing the findings.

This skill is the Codex replacement for external review packs such as `everything-claude-code`: it bundles code correctness, security, functional coverage, and verification assessment into one structured review.

## Inputs

Use the best available context:

- `docs/plans/PLAN-*.md` or a task spec
- Current git diff or a named branch/commit range
- Changed files listed by the user
- Test, build, or lint output if provided

If the review target is ambiguous, ask one concise question before reviewing.

## Review Passes

1. Code correctness
   - Look for bugs, regressions, broken contracts, state errors, async/race issues, data loss, and missing edge-case handling.
   - Check tests for meaningful assertions around changed behavior.

2. Security
   - Check auth, authorization, input validation, injection, path traversal, unsafe file operations, secrets, sensitive logs, unsafe HTML/script handling, deserialization, and dependency risk.
   - Scope the depth to the changed surface area.

3. Functional coverage
   - Extract requirements from the plan/spec/task.
   - Map each requirement to implementation evidence and test evidence.
   - Mark gaps as findings when requirements are missing, partial, or untested.

4. Verification
   - Identify the smallest relevant commands for lint, typecheck, build, and tests.
   - Run them when appropriate and allowed.
   - If not run, state why.

## Output Format

Lead with findings. Do not start with a summary.

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

After findings, include:

```markdown
## Open Questions
- <only if needed>

## Verification
- <command>: PASS | FAIL | not run (<reason>)

## Functional Coverage
- Total requirements: N
- Implemented: N/N
- Tested: N/N
- Verdict: PASS | FAIL
```

If there are no findings, say that clearly and still report verification gaps or commands not run.
