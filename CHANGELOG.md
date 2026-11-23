# Changelog

## [0.3.1] - 2026-11-23

First public release of `slop-diet`.

- UI and UX design laws with real numbers for spacing, type, contrast, touch targets and motion, routed from one `SKILL.md`.
- A design direction picked from the product's domain, and a list of common AI tells to avoid.
- Motion with purpose: scroll motion that never hides content, with a small starter kit.
- `scripts/verify.mjs`: one command that checks the finished page in a real browser (contrast in every state, focus rings, touch targets, overflow at 320, 390 and 1440 px, heading structure, content visible without JavaScript). Exit 0 pass, 1 floor fail, 2 check error.
- Installs on its own as a Claude Code plugin (`slop-diet@mfsass-skills`) or with `npx skills add mfsass/skills --skill slop-diet`.
