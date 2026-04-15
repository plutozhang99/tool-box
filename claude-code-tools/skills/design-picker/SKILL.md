---
name: design-picker
description: Set up a DESIGN.md for the current project. Browse 60+ brand design systems (Stripe, Vercel, Linear, Apple, etc.), fetch the full design spec from getdesign.md, and write it to the project root. From that point on, Claude reads DESIGN.md before writing any UI code.
triggers:
  - "design picker"
  - "DESIGN.md"
  - "pick a design"
  - "design reference"
  - "setup design"
  - "design like"
---

# Design System Setup

You are setting up a `DESIGN.md` file for the current project. This file tells you exactly how to style every UI element — colors, typography, spacing, components, and the rationale behind each decision. You **must read DESIGN.md before writing any UI code** in this session.

## What is DESIGN.md?

A plain-text design system document (introduced by Google Stitch) that AI agents read to generate consistent UI. It contains:

1. **Visual theme & atmosphere** — the brand's feel and philosophy
2. **Color palette & roles** — every color with its hex value and semantic purpose
3. **Typography rules** — font family, size hierarchy, weight, tracking, with context for usage
4. **Component styles** — buttons, cards, inputs, nav — all states (hover, focus, disabled)
5. **Layout principles** — spacing scale, grid, container widths
6. **Depth & elevation** — shadow system and surface hierarchy
7. **Do's and don'ts** — design guardrails and anti-patterns
8. **Responsive behavior** — breakpoints, touch targets, collapse strategy
9. **Agent prompt guide** — quick color reference and ready-to-use prompts

---

## Step 1 — Check for existing DESIGN.md

Check if `DESIGN.md` already exists in the project root:
- If yes: read it, confirm with user whether to keep or replace it
- If no: proceed to brand selection

---

## Step 2 — Brand Selection

Present the full collection, grouped by category. Ask the user to pick one.

### AI & LLM Platforms
`claude` · `cohere` · `elevenlabs` · `minimax` · `mistral.ai` · `ollama` · `opencode.ai` · `replicate` · `runwayml` · `together.ai` · `voltagent` · `x.ai`

### Developer Tools & IDEs
`cursor` · `expo` · `lovable` · `raycast` · `superhuman` · `vercel` · `warp`

### Backend, Database & DevOps
`clickhouse` · `composio` · `hashicorp` · `mongodb` · `posthog` · `sanity` · `sentry` · `supabase`

### Productivity & SaaS
`cal` · `intercom` · `linear.app` · `mintlify` · `notion` · `resend` · `zapier`

### Design & Creative Tools
`airtable` · `clay` · `figma` · `framer` · `miro` · `webflow`

### Fintech & Crypto
`coinbase` · `kraken` · `revolut` · `stripe` · `wise`

### E-commerce & Retail
`airbnb`

### Media & Consumer Tech
`apple` · `ibm` · `nvidia` · `pinterest` · `spacex` · `spotify` · `uber`

### Automotive
`bmw` · `ferrari` · `lamborghini` · `renault` · `tesla`

---

## Step 3 — Fetch and Install

Once the user picks a brand (e.g. `stripe`):

1. Fetch the design spec using WebFetch:
   ```
   URL: https://getdesign.md/{brand}/design-md
   ```
   Example: `https://getdesign.md/stripe/design-md`

2. Extract the markdown content from the page response

3. Write it to `DESIGN.md` in the **current project root**

4. Confirm: "DESIGN.md installed — {Brand} design system is now active for this project."

---

## Step 4 — Activate Design Mode

After installing, read the full DESIGN.md and internalize:
- The primary background, surface, and accent colors
- The font family and size scale
- The border-radius and spacing scale
- The shadow / depth approach (border-based vs shadow-based)
- The core do's and don'ts

From this point forward in the session:
- **Always reference DESIGN.md before writing any UI component**
- Use the exact color tokens, spacing values, and typography rules defined in the file
- Follow the do's and don'ts — these are the most important guardrails
- When the spec doesn't cover a specific case, extrapolate from the established system rather than defaulting to generic patterns

---

## Notes

- The design spec is a **starting language**, not a finished theme. You implement the rules; the file describes what the rules are.
- If the user wants to mix two brands (e.g. "Vercel layout with Stripe colors"), fetch both, identify which sections to take from each, and merge them into a single DESIGN.md.
- If the user asks to customize the installed DESIGN.md, edit it directly — treat it like code, version it with the project.
- Remind the user they can update `git pull` the local clone at `~/Documents/tool-box/awesome-design-md` to get new brand additions as they're released.
