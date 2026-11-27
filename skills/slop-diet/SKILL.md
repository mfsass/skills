---
name: slop-diet
description: "Use whenever you build, change or review any web page or UI, even a small one: landing pages, pricing, dashboards, settings, signup forms, checkout, onboarding, components, plain HTML and CSS, fixes for generic AI-looking design. Load it before you write markup. Not for native mobile apps or backend code."
license: MIT
---

# slop-diet

A reviewer rejects a screen for one sloppy detail, and forgets a screen with no idea. Win the first look, the first click and the 320px phone, and leave one moment people remember. The floor (contrast, targets, no overflow, no tells) is strict. Above it the rules are defaults; the brief wins. Lift the page to good practice; keep the look the prompt, the host `DESIGN.md` or the existing page sets.

Setup (filled in when this skill loaded; no setup step needed):
- Skill folder: `${CLAUDE_SKILL_DIR}`
- Node: !`command -v node || echo "MISSING: no node on PATH"`
- Browser: !`node -e "import('${CLAUDE_SKILL_DIR}/scripts/lib/browser.mjs').then(m=>console.log(m.findChrome()||'no Chrome found: verify uses Playwright if installed, else ends INCOMPLETE'))" 2>&1 | head -1`
- Verify: `node "${CLAUDE_SKILL_DIR}/scripts/verify.mjs" <file.html> --fix --shot`. Run it with the Bash tool in the foreground, `timeout: 300000`. Never set `run_in_background`. It takes 25 to 50 seconds.

## 0. Personalize or audit

- Brief gives brand or audience, forbids questions, or the run is autonomous: go to step 1 and state assumptions. Brand open and a person can answer: ask 1-2 questions.
- IF you improve an existing page THEN read the Preserve lines of [references/law-checklist.md](references/law-checklist.md) first. Restyle; keep elements. When the brief keeps the copy, log the copy rules it trips in `craft-overrides.json`, reason "copy kept per brief".
- Audit, review, polish, bolder, "another round": follow section 5.

## 1. Plan in eight lines

Host `DESIGN.md` and tokens win. Else write:

```
Mode: <Persuade | Operate | Read | Experience>
Context: <domain, audience, the one job of this screen>
Reference: <one archetype or system from references/design-references.md> OR <derived from the brief's world>; accent hue, <light | dark>
Art direction: <one sentence that ties the look to the product's world, and how surfaces separate>
Colour strategy: <restrained | committed | drenched>, 60/30/10 base / supporting / accent; accent marks <action, selection, key data, one highlight>
Focal point: <the one thing the eye lands on first>
Signature moment: <domain subject, visible change, trigger, static fallback>
Boldness: <quiet | distinctive (default) | showpiece>, spent in one place
```

- Art direction: would the same look fit an unrelated product? Revise. Law: surfaces read as distinct levels, never flat white on white. Choose the means: a deep or saturated band that holds content, tonal panels, elevation, or a framed product field.
- Signature moment: the product's own subject (the bike, the room, the queue), shown in the form the product needs: it reacts to input, runs live, or is a strong static composition. If it reacts, it answers within 400ms. The static fallback keeps the character with animation off.
- Boldness is product theatre: the real product, data or main control, big and working, not art experiments. Quiet: type and colour only. Showpiece: one hero sequence, rarely WebGL.

| Mode | Signal | Typical spend (examples, not rules) |
|---|---|---|
| Persuade | Landing, "make it pop" | One bold move: a strong colour field, large display type, or the product big and working; one highlight |
| Experience | Onboarding, booking, wizard | Colour on the focal panel, a signature moment that answers the user, clear step direction |
| Operate | Settings, dashboards, forms | Restrained palette, distinct surface levels, precise alignment |
| Read | Docs, editorial | Calm paper, 65ch measure, little motion |

These rules are UI and UX laws, not one look. Meet each law in the style the product needs. Tactile feedback can be depth, a press-in, a fill or a moving indicator. Motion can be quiet or bold. If every page gets the same treatment, that is new slop.

## 2. Read only the rules this page needs, in ONE command

Pick the files that apply and read them together with one `cat` (paths from the skill folder). Skip the rest.

- You pick or derive a reference: `references/design-references.md` plus only the one system file you pick.
- Picker, date, time, quantity, switch or multi-select: `references/controls.md`, and `assets/tactile-controls.css` for one accessible control build (restyle it).
- Form, settings, table, dashboard or several columns: `references/layout-and-forms.md`.
- Headline, CTA, label or error: `references/ui-copywriting.md`.
- Landing or SaaS page that shows data (chart, figures, bars): `references/craft-floor.md` from "Motion with purpose" on, and `assets/scroll-motion.css`.

## 3. AI tells to avoid

- **Decorative dots:** none. Status is a text label, with semantic colour if it helps.
- **Pill clutter:** three tags per view at most.
- **Glow halos, glass, rainbow or aurora gradients, gradient text.** Physical bevels and layered shadows on controls are fine.
- **Five-hue palettes:** one neutral, one accent.
- **Template chrome:** caps eyebrows, `→` on buttons, emoji icons, side accent bars.

IF verify names a tell you do not recognise THEN read `references/anti-slop.md`.

## 4. Build, verify twice, review once

Craft floor (check each line while you write):

!`awk '/^## Scroll/{exit} NR>4' "${CLAUDE_SKILL_DIR}/references/craft-floor.md"`

Craft starter (`assets/starter.css`, loaded here): paste it first into the page's `<style>`, then map its tokens to the plan. It sets 44px targets at every width, a 2px focus ring, no overlapping hit boxes, reduced motion and the spacing scale, so verify has less to fix. Every rule in it sits in `:where()` (specificity 0): it is a fallback, not a look. It sets no press or hover effect. Choose those for the product (a press-in, a fill, a shadow drop, a moving indicator) and give every control one.

```css
!`cat "${CLAUDE_SKILL_DIR}/assets/starter.css"`
```

1. Write the whole page in one `Write`: starter first, then layout, signature moment and primary path.
2. **Verify run 1:** `node "${CLAUDE_SKILL_DIR}/scripts/verify.mjs" index.html --fix --shot` (Bash, foreground, `timeout: 300000`). `--fix` writes the mechanical fixes (contrast, targets, focus rings, reduced motion) into the file by itself. Every other fail prints as one line: `FAIL <check> <selector> ... -> <fix>`. Read the result before you do anything else. If Bash says the command moved to the background, run it again in the foreground with `timeout: 600000`. Do not read the scripts; the fix line is the answer. Do not run verify again before step 4: keep its fail lines for the one edit. Exit 2 or `INCOMPLETE` is not a pass: report it.
3. **Review in a fresh subagent; do not open the image yourself.** Start one Task (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: false`) with this prompt, filled in:
   > Read `${CLAUDE_SKILL_DIR}/agents/reviewer.md` and follow it. Page: <absolute page path>. Shot: <shot path>. Kind: <persuade | tool>. Brief: <the brief in one line>. Direction: <the user's direction or none>.
   Kind is `persuade` for Persuade and Experience mode and for direction `bolder`; `tool` for Operate and Read mode and for direction `calmer`. `run_in_background: false` makes the Task return its result to you. Do not end your turn before you have the result. Do not run verify before you have the result.
4. **One batched fix:** apply the verify fix lines and all reviewer `FIX` lines in ONE edit (or one script). A T1 FAIL is a rebuild of the focal area around the product's subject, in the same edit. Fix each tell, or log a one-line reason in `craft-overrides.json` as `{"RULE-ID": "reason"}`. Note the check ids of the `FIX` lines you applied in full.
5. **Verify run 2 (the last) and the score, in ONE Bash call** (foreground, `timeout: 300000`), only after step 4:
   ```
   node "${CLAUDE_SKILL_DIR}/scripts/verify.mjs" index.html --fix 2>&1 | tee .slop-verify.txt
   node "${CLAUDE_SKILL_DIR}/scripts/score-card.mjs" .slop-review.txt .slop-verify.txt --kind <persuade | tool> --fixed <ids from step 4, or none>
   ```
   Copy these lines as written; you may put the step 4 edit before them in the same call. The reviewer saved `.slop-review.txt`; if it is missing, use `-` and the reviewer's reply in a `<<'REVIEW'` heredoc. A round without the score-card is not finished: if you ran verify run 2 without it, run score-card alone next, also when verify failed. Add `--card` when the use is explicit (section 5).
   Only `FAIL` lines are floor laws and cap the score; `OPEN` lines are advice. If a FAIL is left, fix it in one edit without verify, and name it. Verify gives two runs per round; a third run only prints the last output. No other screenshots, no second reviewer in the same round.

## 5. Score and offer

The score comes from the score-card output only: never write your own number. Use is **explicit** when the user typed `/slop-diet` or asked to audit, review, improve, polish, or make it bolder or calmer. Otherwise use is **auto** (the skill loaded by itself).

- Auto: ask no questions; the fix round in step 4 is silent. Explicit: `--card`; the block ends with your one question.
- Your final message is the score-card's FINAL REPLY block, word for word, and nothing else: no summary or note before it, nothing after it.

Verbs (each one is one round: max 2 verify runs, one reviewer, one edit):
- `audit`, `review`: verify run 1 with `--shot` and no `--fix`, piped `2>&1 | tee .slop-verify.txt`; reviewer (step 3); then score-card as in step 5 (without the verify line) with `--fixed none --card`. Change no file.
- `polish`, `improve`, or "another round" with no direction: steps 2 to 5 on the existing page.
- `bolder`: as `polish` with Kind `persuade` and Direction `bolder`; the edit also pushes T1 and N1. `calmer`: as `polish` with Kind `tool` and Direction `calmer`.
- "another round" with a direction: as `polish`, with the user's words as Direction for a NEW reviewer Task.
- `max`, "go further": run as `bolder`, then say that a deeper max round is not available yet.

## Output contract

The final message is the score-card's FINAL REPLY block (section 5): the files, the verify `report` line (`Verify: <PASS floor checks | failing checks>; open: <advice>. Exceptions: <craft-overrides.json entries or none>.`) and the score line.

Example. Brief: "booking page for a bike-repair workshop". Plan: Mode Experience; Context: riders book a repair; Reference: control as hero, derived from the workshop bench; Art direction: steel-grey bench surfaces with a chain-oil black band behind the summary, safety-orange accent; Strategy committed, 60/30/10, accent marks the chosen parts and the Book button; Focal: the bike drawing; Signature moment: a line drawing of the bike, tapping a repair lights that part in orange and the price and finish time tick within 200ms, static fallback shows chosen parts filled; Boldness distinctive, spent on the drawing. Final message (auto), the block as printed: `Files: booking.html`, `Verify: PASS floor checks (3 viewports, 0 console errors). Exceptions: none.`, `Score 91% (10 of 11). Open: N1 Motion - .steps -> slide the next step in from the right. Say 'another round' and a direction (bolder, calmer, or your own words).`

Adapted in part from Impeccable (Apache-2.0); credits in references/craft-floor.md.
