# Evals, Rubric Scoring, and Judge Calibration

Prompts alone drift. Measure every build with a two-level loop: fast hand checks first, then calibrated visual review.

## Level 1: Hand checks

Run the checks in [without-scripts.md](without-scripts.md) and fix every Floor failure before human review. The full edition automates them with one command (`npx skills add mfsass/skills --skill slop-diet`).

## Level 2: Pass/Fail Floor + Weighted Rubric

Grade rendered captures on a clear 100-point rubric that separates objective correctness from taste:

| Gate | Weight | Pass Condition |
|---|---|---|
| **1. Floor (Blocking)** | Pass / Fail | Zero Floor fails in the hand checks. Any fail caps the total verdict at `FAIL`. |
| **2. UX Laws & Usability** | 30 pts | Clear visual hierarchy, clean chunking (Miller), restrained choices (Hick), native affordances (Jakob), helpful error/input states (Postel). |
| **3. Anti-Slop Hygiene** | 25 pts | Zero unresolved Reflex slop flags; honest, concrete domain copy; consistent iconography and spacing rhythm. |
| **4. Motion & Tactile Craft** | 20 pts | Crisp `:hover`/`:active`/`:focus` feedback, snappy Doherty timing (state changes `120-220ms`, see [craft-floor.md](craft-floor.md#motion-timing-by-surface)), purposeful easing, `prefers-reduced-motion` parity. |
| **5. Flavour & Domain Fit** | 25 pts | Fits `DESIGN.md` / `product.md` / the mode (Persuade, Experience, Operate, Read) and lands one intentional signature visual move without looking sterile or templated. |

- **PASS:** Floor = PASS and Rubric `>= 80/100` (with Flavour `>= 18/25` so sterile wireframes do not sneak through).
- **POLISH:** Floor = PASS and Rubric `65-79/100`, or Rubric `>= 80/100` with Flavour `< 18/25`.
- **FAIL:** Any Floor failure or Rubric `< 65/100`.

## Calibrating the Judge With Human Votes

Visual taste is partly subjective. Align the cold reviewer (`agents/reviewer.md` in the plugin root) to real human judgment using few-shot preference pairs:

1. Collect blind human votes across diverse variants (Slop vs Over-Constrained Boring vs Crafted with Flavour).
2. Write short one-line critiques explaining *why* a variant won or lost.
3. Write the votes and notes into `assets/calibration-fewshot.json`.
4. Pass `assets/calibration-fewshot.json` to `agents/reviewer.md` as few-shot anchors. Track precision and recall between judge verdicts and human votes whenever you change a rule or prompt.

## Files this page uses

- [without-scripts.md](without-scripts.md) (hand checks), [../assets/laws.yaml](../assets/laws.yaml) (law table the reviewer uses), [../assets/calibration-fewshot.json](../assets/calibration-fewshot.json) (human-vote anchors), [tactile-controls.md](tactile-controls.md).
- Agent: `agents/reviewer.md` in the plugin root (cold judge).
