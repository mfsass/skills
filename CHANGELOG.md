# Changelog

## [Unreleased]

## [0.3.2] - 2026-11-23

### Fixed
- `verify.mjs` finds Microsoft Edge (and a per-user Chrome install on Windows) when Google Chrome is not installed, so the browser checks run on a default Windows machine.
- With no browser, `verify.mjs` now reports `LINT ONLY` instead of `PASS lint floor`, and says contrast, targets and overflow were not verified. The exit code is still 0.

### Changed
- One description everywhere: "Makes coding agents follow UI and UX design laws, then checks the page in a real browser." (the directory edition says "checklist" because it ships no scripts).
- Skill README: the rules in numbers, a "What it runs" section, the Sonnet cost claim removed, and the Adham Dannaway credit filled in.
- Added `CONTRIBUTING.md` and issue templates.
- Each skill installs on its own. The repo-wide plugin is gone: `.claude-plugin/marketplace.json` lists one plugin per skill (`slop-diet` from `skills/slop-diet`), and the skill folder carries its own `.claude-plugin/plugin.json` and reviewer agent (`agents/reviewer.md`, named `slop-reviewer`). Install with `/plugin install slop-diet@mfsass-skills` or `npx skills add mfsass/skills --skill slop-diet`.
- README: per-agent install notes, a "By the numbers" block and `docs/adding-a-skill.md`.

### Added
- `directory/slop-diet`: a Claude plugin directory edition for submission. It holds only Markdown, JSON, YAML and PNG (the directory refuses code files from unverified organisations): the CSS and JS starters are fenced code in `references/`, the script checks are hand checks in `references/without-scripts.md`, and it carries `.claude-plugin/icon.png`. Generated from the full skill; `skills/slop-diet` is unchanged for `npx skills add` and `/plugin install`.

## [0.3.1] - 2026-11-23

### Added
- Motion with purpose: rules in `craft-floor.md` for scroll motion on landing and SaaS pages (self-drawing chart line, count-up, bar grow, list stagger 30-80 ms), content complete without JS and with reduced motion, checklist items C57 to C59, and a zero-dependency starter kit in `assets/scroll-motion.css` and `assets/scroll-motion.js`.
- `scripts/verify.mjs`: one verify command (slop-lint, probe-dots, overflow at 320, 390 and 1440, screenshots in `ui-capture/`). With no browser it still lints and prints one NOTICE line.
- Colour proportion default: about 60/30/10 of visible area as base / supporting / accent, mapped to restrained, committed and drenched (`references/craft-floor.md`). `scripts/lib/colour-split.mjs` measures it from the live page and `verify.mjs` prints it as INFO, never a fail.
- `references/law-checklist.md` is now a numbered applicability checklist (C1 to C56, one check per line) that covers the craft floor, controls, layout, copy and anti-slop rules. It runs before the final verify; the reply ends with `Checklist: X/N applied, Y N/A, Z fixed`.
- `verify.mjs` floor probes (`scripts/lib/floor-probes.mjs`): text contrast of buttons, links, inputs, tabs and selected items at rest, :hover, :focus-visible and :active (forced with CDP), 44x44 targets at 390, and console errors on load. Exit 1 names the failing check; exit 0 when all pass or when no browser is available.
- Scroll and detail moments by mode in `references/craft-floor.md` (Persuade and Read reveal on scroll, Experience one product moment, Operate none; content visible without JS; off under reduced motion).
- `references/design-references.md`: derive palette and type from the brief's own world when no reference fits.

