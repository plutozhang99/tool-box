# Codex Skill Guide

This is a compact local reference for writing Codex skills in this repo.

## What A Skill Is

A Codex skill is a directory with a required `SKILL.md`. The file contains YAML frontmatter and markdown instructions. Codex uses the frontmatter to decide when to load the skill, then follows the body as task-specific guidance.

```text
my-skill/
└── SKILL.md
```

Optional resources may be added when they directly support the skill:

```text
my-skill/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

## Minimal SKILL.md

```markdown
---
name: my-skill
description: Use when the user wants Codex to do a specific kind of task. Include trigger phrases and the expected input/output in this description.
---

# My Skill

Follow this workflow:

1. Inspect the relevant inputs.
2. Make the smallest useful plan.
3. Execute or report according to the task.
4. Verify the result.
```

## Frontmatter

Use these fields by default:

- `name`: stable skill name
- `description`: when Codex should use it; this is the most important activation text

Avoid Claude-only fields such as `allowed-tools`, `disable-model-invocation`, `context`, `agent`, and dynamic shell injection. They are not part of this Codex skill set.

## Writing Style

- Keep `SKILL.md` concise.
- Put detailed reference material in `references/` and tell Codex when to read it.
- Put deterministic helpers in `scripts/`.
- Do not include extra README files inside individual skill directories.
- Prefer concrete workflows over broad advice.
- Do not rely on external skill packs that are not installed locally.

## Review Skills

This repo does not have a GPT/Codex port of `everything-claude-code`. Review workflows should be written directly into Codex skills:

- Code review: bugs, regressions, broken contracts, missing tests
- Security review: auth, validation, injection, secrets, unsafe IO, dependency risks
- Functional coverage: requirement matrix with implementation and test evidence
- Verification: lint, typecheck, build, and test commands when available

Use file and line references for findings. Keep summaries brief and put findings first.

## Installation

Install a skill by symlinking its directory:

```bash
mkdir -p ~/.codex/skills
ln -sf ~/Documents/tool-box/codex-tools/skills/<skill-name> ~/.codex/skills/<skill-name>
```

## Creating A New Skill

1. Create `codex-tools/skills/<skill-name>/SKILL.md`.
2. Add `name` and `description` frontmatter.
3. Write only the workflow Codex needs.
4. Add scripts, references, or assets only when useful.
5. Update `codex-tools/skills/README.md`.
6. Symlink it into `~/.codex/skills`.
