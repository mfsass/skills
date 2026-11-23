---
name: slop-diet
description: "Use whenever you build, change or review any web page or UI, even a small one: landing pages, pricing, dashboards, settings, signup forms, checkout, onboarding, components, plain HTML and CSS, fixes for generic AI-looking design. Load it before you write markup. Not for native mobile apps or backend code."
license: MIT
---

# slop-diet

A reviewer rejects a screen for one sloppy detail. Win the first look, the first click and the 320px phone. The floor (contrast, targets, no overflow, no tells) is strict. Above it the rules are quiet defaults, the brief wins, and the look is yours.

## 0. Personalize or audit

- Prompt gives brand, reference or audience, says not to ask, or the run is autonomous: go to step 1 and state your assumptions in the plan. Brand open and a person can answer: ask 1-2 questions first.
- IF you improve an existing page THEN read the Preserve lines of [references/law-checklist.md](references/law-checklist.md) first. Restyle, do not swap elements. When the brief keeps the copy, note the copy rules it trips in your reply, reason "copy kept per brief".
- Audit: go to section 5 steps 3 and 6, then report the Audit output.

## 1. Plan in seven lines

Host `DESIGN.md` and tokens win. Else write:

```
Mode: <Persuade | Operate | Read | Experience> 
Context: <domain, audience, the one job of this screen>
Reference: <one system from references/design-references.md> OR <palette and type derived from the brief's world: materials, era, domain>; accent hue, <light | dark>, one-sentence physical scene
Colour strategy: <restrained | committed | drenched> + which surfaces carry tint + 60/30/10 split: base / supporting / accent
Focal point: <the one thing the eye lands on first; Persuade and Experience give it the on-load entrance>
Signature control: <one non-default, tactile control that fits the data>
Accent role: <what the accent marks: action, selection, key data, one highlight>
```

- IF you pick a reference or derive from the brief's world THEN read [references/design-references.md](references/design-references.md) (section "Derive from the brief's world"). Copy structure, not hue.

| Mode | Signal | Spend |
|---|---|---|
| Persuade | Landing, "make it pop" | Committed or drenched colour field, display type 56px+, one designed motion highlight |
| Experience | Onboarding, booking, wizard | Committed colour on the focal panel, tactile signature control, directional steps |
| Operate | Settings, dashboards, forms | Restrained palette, tinted panels, precise alignment, 120-220ms states |
| Read | Docs, editorial | White paper, 65ch measure, little motion |

## 2. Taste defaults

1. **Colour that marks structure.** In Persuade, Experience and Operate each panel gets its own tinted surface (accent at 4-10%, or one neutral step) so groups separate without lines. Persuade and Experience may add one deep contrasting panel; Operate may use a dark sidebar; Read keeps white paper.
2. **Accent has a job.** It covers about 10% of the area, on primary actions, the selected state, key data marks and one highlight. Under restrained or committed, an accent at 0% is a bug; drenched may carry it in the base.
3. **One control is clearly not a default.** IF the brief has a form, a picker, a date or a quantity THEN read [references/controls.md](references/controls.md) before you write markup.
4. **Entrances follow the mode.** Persuade and Experience: one 300-600ms entrance on the focal element (rise 8-16px plus fade) on load; Operate and Read need none. Scroll moments follow craft-floor.md; content shows without JS and motion stops under reduced motion. IF a landing or SaaS page shows data (chart, figures, bars, list) THEN read [Motion with purpose](references/craft-floor.md#motion-with-purpose) and use [the scroll-motion starter](references/scroll-motion-starter.md).
5. **Separate with surfaces, not strokes.** Tint, elevation and spacing first; a full 1px border when a line is needed, never a one-side accent bar.
6. **Hold the narrow width.** At 320, nothing overlaps, clips or scrolls sideways; targets are 44x44px or more.
7. **Equal heights.** Controls in one row share one height (44-48px). Selected states never shift layout.
8. **Finish the brief, then one step past it.** Preselect a default, answer every click within 400ms, offer Undo for destructive actions, and add the empty, error, success and done states.

## 3. AI tells to avoid

- **Decorative dots** beside a status: use a text label or icon.
- **Pill clutter:** three tinted tags per view at most.
- **Gradients, glass, glow, gradient text:** use flat colour fields or a working product artifact.
- **Five-hue palettes:** one neutral family, one accent.
- **Template chrome:** ALL-CAPS eyebrows, `→` on every button, emoji icons.

IF a review names a tell you do not recognise THEN read [references/anti-slop.md](references/anti-slop.md).

## 4. First-look craft

- **Hierarchy.** One focal point per viewport, three text tones.
- **Type.** One scale ratio. Body 16-18px, line height 1.5, 45-80ch; ink `#0A0A0A` to `#1A1A1A`.
- **Spacing.** 8pt scale, tighter inside groups than between them. IF the page has a form, a settings layout or more than one column of controls THEN read [references/layout-and-forms.md](references/layout-and-forms.md).
- **Copy.** IF you write a headline, CTA, label or error THEN read [references/ui-copywriting.md](references/ui-copywriting.md).

## 5. Build, measure, fix

Paths such as `references/` resolve from this skill's folder.

1. Read [references/craft-floor.md](references/craft-floor.md) just before the first write and paste its shared interaction block. It holds the target rule, the scroll-moment table and the timings.
2. Build layout, signature control (per controls.md) and primary path first. Press and switch styles: [references/tactile-controls.md](references/tactile-controls.md).
3. Check the page by hand with [references/without-scripts.md](references/without-scripts.md): overflow at 320, 390 and 1440, state contrast, focus rings, 44x44 targets, content without JS, console errors and page structure. This edition ships no scripts.
4. Look at the screenshots: focal point, colour separation, clipping.
5. Fix floor failures. Fix each tell or give a one-line reason in your reply (tells only). Stop after 3 fix rounds.
6. Read [references/law-checklist.md](references/law-checklist.md) in full, mark each check C1 to Cn applies or N/A, and fix each one that applies and fails.
7. Repeat the hand checks until every one passes.

IF you score builds or calibrate a judge THEN read [references/eval-and-calibrate.md](references/eval-and-calibrate.md). IF you want a cold visual review THEN use the `slop-reviewer` agent.

## Output contract

End with `Checklist: X/N applied, Y N/A, Z fixed` plus any check left failing.

- Build output: files changed, plan lines, check results, what is unresolved.
- Audit output: scores, tells hit, floor failures, fixes.

Adapted in part from Impeccable (Apache-2.0); credits in references/craft-floor.md.
