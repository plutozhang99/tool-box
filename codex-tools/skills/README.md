# Codex Skills

Personal Codex skills for project planning, phase execution, functional coverage review, and project design setup.

These are translated from `claude-code-tools`, but they are not a one-to-one port. Codex does not have the `everything-claude-code` skill pack or Claude model routing, so phase execution now hands phase-end review to the local `phase-review` skill.

## Install

Install by symlinking each skill directory into your Codex skills folder:

```bash
mkdir -p ~/.codex/skills
ln -sf ~/Documents/tool-box/codex-tools/skills/plan-project ~/.codex/skills/plan-project
ln -sf ~/Documents/tool-box/codex-tools/skills/execute-phase ~/.codex/skills/execute-phase
ln -sf ~/Documents/tool-box/codex-tools/skills/phase-review ~/.codex/skills/phase-review
ln -sf ~/Documents/tool-box/codex-tools/skills/functional-coverage ~/.codex/skills/functional-coverage
ln -sf ~/Documents/tool-box/codex-tools/skills/design-picker ~/.codex/skills/design-picker
```

Update the local source with:

```bash
cd ~/Documents/tool-box && git pull
```

## Skills

### `plan-project`

Use when you want Codex to turn a PRD, spec, or verbal idea into an executable project plan.

The skill reads the supplied spec if there is one, discusses tradeoffs with you, decomposes the work into phases and tasks, writes `docs/plans/PLAN-<name>.md`, then stops. It does not write implementation code.

### `execute-phase`

Use when a project already has a `docs/plans/PLAN-*.md` and you want Codex to complete one phase.

The skill executes a single phase, keeps `docs/progress/PROGRESS.md` current, runs local verification, uses `phase-review` for the phase-end review, updates the plan checkboxes, archives progress, commits the phase, pushes it to GitHub, then stops. It does not require `everything-claude-code`.

The phase-end review uses `phase-review`, which includes:

- Code review: bug and regression-focused review of the phase diff
- Security review: auth, data exposure, injection, secrets, dependency, and destructive operation checks
- Functional coverage: requirement-by-requirement implementation and test coverage review
- Verification assessment: relevant lint, typecheck, build, and test command status

### `phase-review`

Use when you want the review bundle as a standalone read-only pass.

This is the local Codex replacement for external reviewer packs: it reviews code correctness, security, functional coverage, and verification status in one findings-first report.

### `functional-coverage`

Use for a read-only feature completeness review.

The skill extracts requirements from the spec or task description, searches the codebase for implementation evidence, checks tests for meaningful assertions, and returns a PASS/FAIL matrix.

### `design-picker`

Use when starting UI work and you want a `DESIGN.md` at the project root.

The skill checks for an existing `DESIGN.md`, helps pick a brand design reference, fetches the `getdesign.md` design spec, writes `DESIGN.md`, then treats that file as the active UI design system.

## Add A Skill

1. Create `codex-tools/skills/<skill-name>/SKILL.md`.
2. Include YAML frontmatter with at least `name` and `description`.
3. Keep the body focused on the workflow Codex should follow.
4. Add optional scripts, references, or assets only when they directly support the skill.
5. Add a symlink into `~/.codex/skills/<skill-name>`.
6. Document it in this README.
