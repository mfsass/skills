# Changelog

## [0.3.1] - 2026-11-23

### Added
- Motion with purpose: rules in `craft-floor.md` for scroll motion on landing and SaaS pages (self-drawing chart line, count-up, bar grow, list stagger 30-80 ms), content complete without JS and with reduced motion, checklist items C57 to C59, and a zero-dependency starter kit in `assets/scroll-motion.css` and `assets/scroll-motion.js`.
- `scripts/verify.mjs`: one verify command (slop-lint, probe-dots, overflow at 320, 390 and 1440, screenshots in `ui-capture/`). With no browser it still lints and prints one NOTICE line.
- Colour proportion default: about 60/30/10 of visible area as base / supporting / accent, mapped to restrained, committed and drenched (`references/craft-floor.md`). `scripts/lib/colour-split.mjs` measures it from the live page and `verify.mjs` prints it as INFO, never a fail.
- `references/law-checklist.md` is now a numbered applicability checklist (C1 to C56, one check per line) that covers the craft floor, controls, layout, copy and anti-slop rules. It runs before the final verify; the reply ends with `Checklist: X/N applied, Y N/A, Z fixed`.
- `verify.mjs` floor probes (`scripts/lib/floor-probes.mjs`): text contrast of buttons, links, inputs, tabs and selected items at rest, :hover, :focus-visible and :active (forced with CDP), 44x44 targets at 390, and console errors on load. Exit 1 names the failing check; exit 0 when all pass or when no browser is available.
- Scroll and detail moments by mode in `references/craft-floor.md` (Persuade and Read reveal on scroll, Experience one product moment, Operate none; content visible without JS; off under reduced motion).
- `references/design-references.md`: derive palette and type from the brief's own world when no reference fits.

### Changed
- Kept copy: when the brief says to keep the content, the skill does not rewrite it and records the copy rules it trips (`SLOP-BUZZWORDS`, `SLOP-VANITY-STATS`) in `craft-overrides.json` with reason "copy kept per brief", so lint can reach `PASS`.
- `SKILL.md` routes references with explicit IF/THEN triggers at the step that needs them, reads the law checklist once (full pass before the final verify), names the accent's job (about 10%: actions, selection, key data, one highlight) and makes the deep panel and other structural moves mode-conditional.
- One value everywhere: 44px targets (one dense-desktop Operate exception, in craft-floor.md), 16px body prose, ink `#0A0A0A` to `#1A1A1A` instead of pure black, chart fill 80%. The `UX-FITTS-TARGET` lint threshold stays at 32px (clearly too small); only its message changed.
- `verify.mjs` never prints PASS when a check errors or times out: it reports ERROR and exits 2 (1 = floor fail, 0 = pass or no-browser NOTICE). On PASS it prints a Next line for the checklist pass; `--checklist-done` leaves it out. `--strategy` sets the colour strategy; else it is inferred.
- Floor probes follow the strict scorecard: composited opacity, all text nodes, disabled controls at 3:1, selected segments and radio-label pills, contrast at 390 and 1440, focus rings of 3:1 and 2px or more (R-05), target overlaps (R-04), a reveal check with JS off and reduced motion (a build that hides text until a script runs fails), and a page-structure check (R-12: one h1, no skipped levels, ordered heading sizes, a main landmark, 7 nav links or fewer). Mobile widths use mobile emulation and a viewport meta check.
- Colour split is strategy-aware (restrained, committed, drenched bands); an accent at 0% is flagged only for restrained and committed.
- Scroll reveal is one-shot: visible by default, `js-reveal` on `<html>`, an IntersectionObserver adds `is-in` once; the scroll-linked variant is gone. The shared hover and press rules sit in `:where()` (specificity 0,0,0), and `.ui-craft-pressable` owns its own press scale. Two-tint surfaces, the load entrance and the press scale are scoped to the modes that use them; the cream-and-clay and aurora checks stay overridable reflex flags: a palette derived from the brief that trips one is logged in `craft-overrides.json` with a one-line reason, and the `SLOP-CREAM-CLAY` message says so.
- `craft-overrides.json` is found beside the target, else in the current folder; invalid JSON exits 2. `capture-ui.mjs` takes a file path and reports console, page and request errors; `probe-dots.mjs` counts svg circles and mobile hits.
- Release fixes: `browser.mjs` no longer reports a failed favicon request as a console error; both reviewer prompts find the skill folder after a plugin install and use the `verify.mjs` output; `slop-lint.mjs`, `capture-ui.mjs`, `check-styles.mjs`, `score-preferences.mjs` and `ui-eval.mjs` document exit codes (2 = bad input); `ui-eval.mjs` accepts `playwright-core`; third-party credits are in `THIRD_PARTY_NOTICES.md`.
- `SKILL.md` stays at 1100 words or fewer; the Buttons, Forms and Theme-the-browser lines moved to the checklist.

## [0.3.0] - 2026-11-23

Repo restructured as a multi-skill repo (`skills/<name>/`). `slop-diet` is the first skill.

### Changed
- Release clear wins: pruned unused references, tool-adaptive capture and probe scripts, and a per-surface motion table.
- Not re-benchmarked: the final-pass edits were not run through the benchmark again. The results in the README come from the earlier candidate.

### Earlier changes in this line
- New references: `law-checklist.md`, `controls.md`, `craft-floor.md`; new lint rule `SLOP-SIDE-BAR`.
- Improve mode keeps each control's role, name and every link visible (restyle, do not swap).
- 44px for every tappable element. Finish the brief, then go one step past it.
- The brief wins: `SLOP-STATUS-DOT` and the pill limit can be overridden with a one-line reason in `craft-overrides.json`.
- One value per rule: body 16-18px at 1.5 and 45-80ch, press `scale(.97)` in 120ms, review viewport 390x844, at most three pills per view.
- Lint: `PASS` means zero open findings. `SLOP-VANITY-STATS` detects a stat grid of three or more bare figures with no source.
- `capture-ui.mjs` and `probe-dots.mjs` fall back to headless Chrome, and print a NOTICE and exit 0 when no browser is found.
- Credits added (Impeccable, Practical UI, `frontend-design`, UX laws, WCAG, Apple HIG).

## [0.2.0] - 2026-11-21

Recalibrated after blind human votes passed only 1 of 4 skill outputs (colored dots, pill clutter, odd palettes, off image placement).

### Added
- `references/design-references.md`: seven proven product systems with token blocks, type stacks, spacing and tactile motion, plus a prompt-to-dials table.
- `references/ui-copywriting.md`, `references/layout-and-forms.md`.
- Lint rules `SLOP-CLASHING-PALETTE`, `SLOP-STATUS-DOT`, `SLOP-PILL-CLUTTER`, `SLOP-CREAM-CLAY`; wider `SLOP-BUZZWORDS` and `SLOP-X-NOT-Y-COPY`.
- `scripts/probe-dots.mjs`: rendered probe that counts dots and pills.
- `UI_CRAFT_CHROMIUM` env var to point scripts at a cached Chromium build.

### Fixed
- `UX-DOHERTY-DURATION` read `.15s` as `15s` and raised false floor failures.

## [0.1.0] - 2026-11-21

### Added
- First release of `slop-diet`: a UI and UX craft router with focused references, a static linter (`slop-lint.mjs`) and a rendered probe suite (`ui-eval.mjs`).
