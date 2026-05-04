---
name: design-picker
description: Use when the user wants Codex to create or update a project-root DESIGN.md from a brand design reference, especially before UI work. Check for an existing DESIGN.md, help choose one or more getdesign.md brands, fetch the design spec, write DESIGN.md, and follow it for subsequent UI code.
---

# Design Picker

Set up a `DESIGN.md` file for the current project. The file becomes the active UI design system for this session.

## Step 1 - Existing Design

Check for `DESIGN.md` in the project root.

- If it exists, read it and ask whether to keep, replace, or merge.
- If it does not exist, proceed to brand selection.

## Step 2 - Brand Selection

Ask the user to pick a brand or describe a mix such as "Vercel layout with Stripe colors".

Common options:

- AI and LLM: `claude`, `cohere`, `elevenlabs`, `mistral.ai`, `ollama`, `replicate`, `runwayml`, `together.ai`, `x.ai`
- Developer tools: `cursor`, `expo`, `lovable`, `raycast`, `superhuman`, `vercel`, `warp`
- Backend and DevOps: `clickhouse`, `hashicorp`, `mongodb`, `posthog`, `sanity`, `sentry`, `supabase`
- Productivity and SaaS: `cal`, `intercom`, `linear.app`, `mintlify`, `notion`, `resend`, `zapier`
- Design tools: `airtable`, `clay`, `figma`, `framer`, `miro`, `webflow`
- Fintech: `coinbase`, `kraken`, `revolut`, `stripe`, `wise`
- Media and consumer tech: `apple`, `ibm`, `nvidia`, `pinterest`, `spacex`, `spotify`, `uber`
- Automotive: `bmw`, `ferrari`, `lamborghini`, `renault`, `tesla`

## Step 3 - Fetch And Write

For each selected brand, fetch:

```text
https://getdesign.md/<brand>/design-md
```

Write the resulting markdown to `DESIGN.md` at the project root. If merging multiple brands, create one coherent design document with clear sections for colors, typography, layout, components, and guardrails.

## Step 4 - Use The Design

After writing `DESIGN.md`, read it and follow it before writing UI code in the same project.

Track:

- Background, surface, text, border, and accent colors
- Font family, type scale, and weights
- Spacing and layout rules
- Border radius and elevation
- Component states
- Do and don't rules

When the design file does not cover a specific component, extrapolate from its existing system rather than falling back to generic styling.
