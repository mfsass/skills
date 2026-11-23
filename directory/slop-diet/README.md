# slop-diet

Make AI-built interfaces look designed, not generated.

slop-diet is for people who build web UIs with Claude Code and keep getting the same generic, AI-looking page. It gives Claude concrete design rules, then a checklist to verify the finished page.

## What it does

- **Real design rules.** Spacing, type and colour follow concrete numbers, with a look that fits your product.
- **Pages that pass the basics.** Contrast, focus rings and 44px touch targets, checked at 320, 390 and 1440 px.
- **No AI tells.** Hype copy, decorative dots, pill clutter and neon gradients stay out.
- **Motion with a purpose.** Animation never hides content, and it stops under reduced motion.
- **Your brief wins.** If you ask for something a rule bans, the skill follows you.

## What is in this edition

- The `slop-diet` skill: rules, a 7-line plan, a checklist of numbered checks and reference files.
- A `slop-reviewer` agent: a cold-context judge that scores screenshots and returns PASS, POLISH or FAIL.
- Hand checks in `skills/slop-diet/references/without-scripts.md`. This edition has no scripts and runs no code.

The full edition adds one command that runs every check in a real browser. Install it with `/plugin marketplace add mfsass/skills` then `/plugin install slop-diet@mfsass-skills`, or with `npx skills add mfsass/skills --skill slop-diet`.

## Try it

After installing, ask: `Build a pricing page for my invoicing app`

## Credits and licence

MIT licence, see `LICENSE`. What was adapted from other projects is in `THIRD_PARTY_NOTICES.md`. Source: https://github.com/mfsass/skills
