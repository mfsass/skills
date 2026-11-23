# slop-diet

Makes coding agents follow UI and UX design laws, then checks the finished page against a numbered checklist.

Agents skip the basic UI and UX laws, so you fix the same things every time: low-contrast text, tiny tap targets, a page that breaks on a phone, hype copy, neon gradients. slop-diet gives Claude concrete rules for spacing, type, contrast, touch targets and motion, then a checklist to verify the finished page.

## What it does

- **Real design rules.** Spacing, type and colour follow concrete numbers, with a look that fits your product.
- **Pages that pass the basics.** Contrast, focus rings and 44px touch targets, checked at 320, 390 and 1440 px.
- **No AI tells.** Hype copy, decorative dots, pill clutter and neon gradients stay out.
- **Motion with a purpose.** Animation never hides content, and it stops under reduced motion.
- **Your brief wins.** If you ask for something a rule bans, the skill follows you.

## The rules, in numbers

| Area | Rule |
|---|---|
| Touch targets | 44 x 44 px or larger, and no two targets overlap |
| Contrast | 4.5:1 for text in every state: rest, hover, focus and active |
| Focus | A visible ring of 3:1 contrast and at least 2 px |
| Type | Body 16 to 18 px, line height 1.5, lines of 45 to 80 characters |
| Spacing | An 8 pt scale, tighter inside a group than between groups |
| Widths | Nothing overlaps, clips or scrolls sideways at 320, 390 and 1440 px |
| Structure | One `h1`, no skipped heading levels, a `main` landmark, 7 nav links or fewer |
| Motion | Content shows without JavaScript and stops animating under reduced motion |

## What is in this edition

- The `slop-diet` skill: rules, a 7-line plan, a checklist of numbered checks and reference files.
- A `slop-reviewer` agent: a cold-context judge that scores screenshots and returns PASS, POLISH or FAIL.
- Hand checks in `skills/slop-diet/references/without-scripts.md`. This edition has no scripts and runs no code.

The full edition adds one command that runs every check in a real browser. Install it with `/plugin marketplace add mfsass/skills` then `/plugin install slop-diet@mfsass-skills`, or with `npx skills add mfsass/skills --skill slop-diet`.

## Try it

After installing, ask: `Build a pricing page for my invoicing app`

## Credits and licence

MIT licence, see `LICENSE`. What was adapted from other projects is in `THIRD_PARTY_NOTICES.md`. Source: https://github.com/mfsass/skills
