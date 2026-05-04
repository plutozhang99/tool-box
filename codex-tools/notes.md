# Codex Project Notes

## Status Line Idea

Show model name, context percentage with a progress bar, and usage quota with a progress bar.

## PRD / Product Workflow

There is no GPT/Codex equivalent of the full `everything-claude-code` skill library in this repo. Use local Codex skills and built-in review behavior instead.

### Direct Replacements

- `plan-project`
  - Conversational project planning from a PRD, spec, or verbal idea.
  - Produces `docs/plans/PLAN-<name>.md`.

- `functional-coverage`
  - Read-only requirement coverage review.
  - Checks that planned behaviors are implemented and tested.

- `execute-phase`
  - Runs one plan phase at a time.
  - Uses a Codex-native phase-end review bundle instead of external reviewer skills.

- `phase-review`
  - Standalone read-only replacement for external reviewer packs.
  - Reviews code correctness, security, functional coverage, and verification status.

### Typical Flow

1. Discovery / brainstorm: talk with Codex normally, or ask for `plan-project`.
2. PRD / spec: write the document directly with Codex, then run `plan-project` against it.
3. Review the plan or phase diff: ask for `phase-review` when you want a formal pass.
4. Execute: run `execute-phase`.
5. Phase-end review: use the built-in bundle: code review, security review, functional coverage, and local verification commands.

### Review Without `everything-claude-code`

Use a single structured review prompt when you need an extra manual pass:

```text
Review the current phase diff. Lead with findings only.
Cover code correctness, security, and functional coverage against docs/plans/PLAN-<name>.md.
For each issue, include severity, file:line, why it matters, and suggested fix.
Also state which lint/build/test commands were run or why they could not run.
```
