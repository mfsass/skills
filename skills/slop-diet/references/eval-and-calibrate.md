# Evals, Rubric Scoring, and Judge Calibration

Prompts alone drift. Measure every build with a two-level evaluation loop modeled on practical AI engineering evals: fast deterministic assertions first, then calibrated visual review.

## Level 1: Deterministic Unit Assertions (Zero LLM Cost)

Run these checks during development and in CI. Fix every Floor failure before human review. Script paths resolve from the skill folder (the folder that holds `SKILL.md`); run them from your project with the full path, for example `node <skill-folder>/scripts/verify.mjs page.html`.

1. **One command: `verify.mjs`.** It runs lint, probe-dots, overflow at 320, 390 and 1440, state contrast, focus rings, target size and overlap, reveal at rest, console errors and page structure, then prints the colour split (base / supporting / accent against the 60/30/10 band for the strategy; INFO only). Exit 0 pass, 1 floor fail, 2 error (not a pass).
   ```bash
   node scripts/verify.mjs <file.html|URL> [--strategy restrained|committed|drenched]
   ```

2. **Static Anti-Slop and UX-Law Lint (`< 200ms`):**
   ```bash
   node scripts/slop-lint.mjs <file-or-dir> --json
   ```
   Checks Fitts hit targets, Hick navigation count, Doherty transition durations, `prefers-reduced-motion`, accessible form labels, native button semantics, `:active` press feedback, plus overridable Reflex slop tells.

3. **Rendered Browser Probes (desktop `1440x900` + mobile `390x844`).** `probe-dots.mjs` and `capture-ui.mjs` use Playwright when importable, else headless Google Chrome, else print one `NOTICE:` line and exit 0. `ui-eval.mjs` needs `playwright` or `playwright-core` (or a module path in `UI_CRAFT_PLAYWRIGHT`, and a browser binary in `UI_CRAFT_CHROMIUM`) and a plan file you write; it is an advanced harness, not part of the normal build loop:
   ```bash
   node scripts/probe-dots.mjs <file.html|URL>
   node scripts/ui-eval.mjs run <plan.json> --out <evidence-dir>
   ```
   Checks computed WCAG contrast, real bounding-box hit targets, horizontal overflow, text clipping, image decode health, duplicate IDs and visual row alignment. CSS syntax is a separate check: `node scripts/check-styles.mjs --project <dir> <file.css|file.html>` parses with the PostCSS installed in that project.

## Level 2: Pass/Fail Floor + Weighted Rubric

Grade rendered captures on a clear 100-point rubric that separates objective correctness from taste:

| Gate | Weight | Pass Condition |
|---|---|---|
| **1. Floor (Blocking)** | Pass / Fail | Zero Floor fails in `verify.mjs` (or in `slop-lint.mjs` and `ui-eval.mjs`). Any fail caps the total verdict at `FAIL`. |
| **2. UX Laws & Usability** | 30 pts | Clear visual hierarchy, clean chunking (Miller), restrained choices (Hick), native affordances (Jakob), helpful error/input states (Postel). |
| **3. Anti-Slop Hygiene** | 25 pts | Zero unresolved Reflex slop flags; honest, concrete domain copy; consistent iconography and spacing rhythm. |
| **4. Motion & Tactile Craft** | 20 pts | Crisp `:hover`/`:active`/`:focus` feedback, snappy Doherty timing (state changes `120-220ms`, see [craft-floor.md](craft-floor.md#motion-timing-by-surface)), purposeful easing, `prefers-reduced-motion` parity. |
| **5. Flavour & Domain Fit** | 25 pts | Fits `DESIGN.md` / `product.md` / the mode (Persuade, Experience, Operate, Read) and lands one intentional signature visual move without looking sterile or templated. |

- **PASS:** Floor = PASS and Rubric `>= 80/100` (with Flavour `>= 18/25` so sterile wireframes do not sneak through).
- **POLISH:** Floor = PASS and Rubric `65-79/100`, or Rubric `>= 80/100` with Flavour `< 18/25`.
- **FAIL:** Any Floor failure or Rubric `< 65/100`.

## Calibrating the Judge With Human Votes

Visual taste is partly subjective. Align the cold reviewer (`agents/reviewer.md`) to real human judgment using few-shot preference pairs:

1. Collect blind human votes across diverse variants (Slop vs Over-Constrained Boring vs Crafted with Flavour).
2. Write short one-line critiques explaining *why* a variant won or lost.
3. Write the votes and notes into `assets/calibration-fewshot.json`.
4. Pass `assets/calibration-fewshot.json` to `agents/reviewer.md` as few-shot anchors. Track precision and recall between judge verdicts and human votes whenever you change a rule or prompt.

## Files this page uses

- Scripts: [verify.mjs](../scripts/verify.mjs) (one command; its browser checks live in `scripts/lib/`: [floor-probes.mjs](../scripts/lib/floor-probes.mjs), [colour-split.mjs](../scripts/lib/colour-split.mjs)), [slop-lint.mjs](../scripts/slop-lint.mjs), [check-styles.mjs](../scripts/check-styles.mjs), [probe-dots.mjs](../scripts/probe-dots.mjs), [capture-ui.mjs](../scripts/capture-ui.mjs), [ui-eval.mjs](../scripts/ui-eval.mjs) (with `scripts/lib/`: [browser.mjs](../scripts/lib/browser.mjs), [probes.mjs](../scripts/lib/probes.mjs), [common-probes.mjs](../scripts/lib/common-probes.mjs), [scoring.mjs](../scripts/lib/scoring.mjs), [verification.mjs](../scripts/lib/verification.mjs)), [check-review.mjs](../scripts/check-review.mjs) for a review record, [score-preferences.mjs](../scripts/score-preferences.mjs) for human-vote scoring.
- Assets: [laws.yaml](../assets/laws.yaml) (law table the probes and the reviewer share), [consistency-checks.mjs](../assets/consistency-checks.mjs) (comparison helpers for plan scenario modules), [calibration-fewshot.json](../assets/calibration-fewshot.json) (human-vote anchors), [tactile-controls.css](../assets/tactile-controls.css).
- Agents: [reviewer.md](../agents/reviewer.md) (cold judge), [openai.yaml](../agents/openai.yaml) (Codex UI metadata only).
