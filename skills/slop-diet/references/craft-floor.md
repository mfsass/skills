# Craft floor: read just before the first write

Rules read right before editing get applied. Check each line against the plan while you write.

1. **Mode and colour.** Mode named. Colour strategy named, derived from the brief's own world when it has one. In Persuade, Experience and Operate at least two surfaces carry tint (page, panel, focal field), so the page is not all white with one blue button; Read keeps white paper and at most one tint step. Split the visible area about 60/30/10 as a quiet default: 60% base (the page neutral), 30% supporting colour (tinted panels, a deep band, the brand-tinted surface family), about 10% accent. The accent is carried by four things only: primary action fills, the selected state (border, tint, check), key data marks (the plotted line, the bar that matters, the active tab) and one highlight (the focal field or figure). Under restrained or committed, an accent at 0% has lost its job: give those four their fill. Never add accent as ornament to reach a number. By strategy: restrained keeps the supporting colour a tinted neutral and the accent at 10% or less; committed makes the supporting colour the brand hue at surface strength (supporting plus accent 30-60%); drenched makes the brand hue the base (60% or more), so its accent may be small or absent. Accent text and buttons still meet contrast. The brief or the host design system wins. `scripts/verify.mjs` prints the measured split against the band for your strategy (`--strategy`), as INFO (never a fail). Derive the palette from a reference or from the brief's own world (materials, era, domain); the split holds either way.
2. **Focal point.** One element is clearly first. In Persuade and Experience it gets the on-load entrance (300-600ms, once); Operate and Read need none. Scroll and detail moments follow the mode table below.
3. **Signature control.** One control is not the browser default and fits the data (see controls.md). It has press and selected states.
4. **Heights.** Every input, select, stepper and button in one row has the same height. Selected or bold states reserve their border and weight, so nothing moves.
5. **States.** Text keeps 4.5:1 (3:1 for text 24px+, or bold 18.66px+) in rest, hover, focus-visible, active and selected; `verify.mjs` forces each state and measures. Hover never turns text unreadable or swaps to an unrelated hue. A selected tab or chip keeps its own text colour on hover. Focus-visible ring on every control: 2px or wider and 3:1 or more against the background beside it (`verify.mjs` measures it). Error beside the field with an icon and a fix. Loading and success states for the primary action.
6. **Narrow width.** At 320: no horizontal scroll, no clipped text, no overlapping elements, targets per item 11, short labels where long ones would wrap. Multi-column layouts collapse to one column. Tables and matrices become cards.
7. **Browser surfaces.** `::selection`, `caret-color`, `accent-color` and focus ring use the palette. `font-variant-numeric: tabular-nums` on figures.
8. **Inputs best practice.** Correct `type`, `inputmode` and `autocomplete` on every field. Format phone numbers as typed. Validate email on blur. Dates before today disabled where they make no sense.
9. **No tells.** No gradients, glass, glow, side accent bars, decorative dots, emoji icons or hype copy. Flat colour fields and real content instead.
10. **Motion.** One entrance on load (Persuade, Experience), state transitions 120-220ms, directional slide for steps (forward left, back right), `prefers-reduced-motion` honoured. Scroll and detail moments follow the mode table below. Animate `transform` and `opacity`, not `top`, `left`, `width` or `height` (an accordion panel may animate `height`, see law-checklist.md). No idle loops on Operate screens. Never `linear` easing except loaders and progress. Surface timings are in the table below.
11. **Target size, stated once.** Every interactive element is at least 44x44px at touch widths (390, 320): buttons, chips, segments, radios, checkbox labels, nav, logo and footer links, icon buttons. Use 48px for frequent actions. The one exception: an Operate screen at 1024px and wider may use 36-40px rows and buttons for dense tables; its 390 layout still gets 44. Inline text links inside a paragraph are exempt. `verify.mjs` measures at 390. Placeholders fit at 320 (short text).
12. **Finish the brief.** Preselect a sensible default so no panel starts empty. Every action gives feedback within 400ms. Destructive actions offer Undo. Add the empty, error and success states the brief implies, and a done screen for a flow.
13. **Choice load.** At most 7 primary nav items. One primary CTA and one secondary action per section. Group metrics, fields and cards in 3-5 and separate groups with space before borders.

## Scroll and detail moments by mode

Quiet defaults; the brief wins. Floor: content is visible at rest without JavaScript (never `opacity: 0` in base CSS while waiting for a script), and everything below is off under `prefers-reduced-motion: reduce`.

| Mode | Allowed |
|---|---|
| Persuade, Read | Sections may reveal on scroll: rise 8-16px plus fade, once per element, ease-out. Stagger per the rule in Motion with purpose below. |
| Experience | One product-tied moment (a chart drawing in, the configurator reacting to input) beside the on-load entrance. |
| Operate | State feedback only (hover, press, selected, saved). No scroll reveals. |

Build it as a one-shot reveal. The page is visible by default. A script adds `js-reveal` to `<html>` only when it will observe something, marks the elements below the fold, and an IntersectionObserver adds `is-in` once per element, then stops observing it. Elements already in view get `is-in` at once, so they never hide. There is no scroll-linked variant: it re-hides on scroll back. Put the script at the end of `<body>`.

```css
.js-reveal .reveal:not(.is-in) { opacity: 0; transform: translateY(8px); }
.js-reveal .reveal { transition: opacity 280ms ease-out, transform 280ms ease-out; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1 !important; transform: none !important; transition: none !important; } }
```

```js
const items = [...document.querySelectorAll('.reveal')];
if (items.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => (el.getBoundingClientRect().top < innerHeight ? el.classList.add('is-in') : io.observe(el)));
  document.documentElement.classList.add('js-reveal');
}
```

`verify.mjs` scrolls through the page before its screenshots and compares the text visible at rest (JS off, reduced motion) with the revealed page.

## Motion with purpose

For landing and SaaS pages that tell a data story. Motion has to show something: a value arriving, a sequence, proof. Quiet defaults; the brief wins.

- **Earns its place:** a data story (a line, bars), proof figures (a few headline numbers), a true sequence (steps, a short list).
- **Does not:** frequent actions, operate-mode dashboards used all day (state feedback only), body text, decoration, every section.
- **One signature scroll moment per page.** Everything else is a plain reveal or static.

| Move | Numbers | Not when |
|---|---|---|
| Reveal | opacity plus `translateY(8px)`, 250-300ms, ease-out `cubic-bezier(.23,1,.32,1)`, once | above the fold in Operate or Read; every section |
| Stagger | 30-80ms per item, last item starts within about 400ms, so 6-8 items at most | not a real list; more than 8 items (group them) |
| Line draw | `pathLength="1"`, `stroke-dashoffset` 1 to 0, 800-1200ms, ease-out; area and dots fade in after the line | the chart is revisited often; labels or ticks hidden at rest |
| Bars grow in | `scaleY(0)` to 1 from the base (`scaleX` from the left), 500-700ms, 40-60ms apart, never animate `height` | more than 12 bars, or bar lengths compared at a glance (fade only) |
| Count up | 600-1000ms, ease-out, once, `tabular-nums`, at most 3-4 per page | price, legal figure, live value |

Count-up and bar-grow numbers are house defaults: no external source, so a brief or host token overrides them. Exits take about 75% of the enter time. Bounce stays 0 (one published motion guide allows 0.1-0.3; this skill does not).

Rules that keep it clean:
- The final state is the markup. Text, numbers, bars, lines, axes and legends are in the HTML and visible at rest. Hidden start states apply only under `html.js` (or `.js-reveal`), never to content above the fold, and the script adds `js` after it has set up the observer.
- `prefers-reduced-motion: reduce` shows the final state at once (a fade at most): no draw, no count, no travel.
- Count-up keeps the real value in the HTML; the script swaps the text only while counting and puts the final value in `aria-label`.
- Optional, same look without a script: a CSS `animation-timeline: view()` reveal inside `@supports (animation-timeline: view())` and `@media (prefers-reduced-motion: no-preference)`. Declare `animation-timeline` after the `animation` shorthand, use `linear` timing and `animation-range: entry 0% entry 60%`. Never put it and the observer reveal on the same element.

Starter kit, zero dependencies: [assets/scroll-motion.css](../assets/scroll-motion.css) and [assets/scroll-motion.js](../assets/scroll-motion.js). Mark elements with `data-m` (reveal), `data-grow` (bar), `data-draw` (path with `pathLength="1"`) and `data-count="1284"` (the span's text is the final value; add `data-dp` for decimals). Put `data-stagger` on a real list or bar group to set the step. Include the CSS and put the script at the end of `<body>`. It is a one-shot observer that exits under reduced motion before it hides anything.

## Motion timing by surface

Starting values for desktop web. The brief or the host project's tokens win; keep one value per surface across the page.

| Surface | Enter | Exit | Scale and distance |
|---|---|---|---|
| Tooltip | 150ms | shorter than the enter | enters from .96-.97 |
| Dropdown, menu | 250ms | 150ms | enters from .96-.97 |
| Modal | 350-450ms | 150ms | enters from .98-.99, exits to .99 |
| Drawer, panel, sheet | 350-450ms (CSS 350ms ease-out; spring: duration .45, bounce 0) | 150ms | sheets travel up to 70% of their own size |
| Toast | 250ms (no source value; treated as a small floating element) | 150ms | as dropdown |
| Press | 120ms | n/a | `scale(.97)`; disabled controls never scale |

- **Easing.** `ease-out` for enters, exits and state changes (the shared block's `cubic-bezier(.2,.8,.2,1)` is one). `linear` only for loaders and progress. Springs use bounce 0.
- **Exit recipe.** Opacity, 4px blur and `translateY(-12px)` over 150ms, ease-out. Exits are shorter and smaller than enters.
- **Stagger.** Staged entrances and real lists only: 30-80ms apart (80ms is the ceiling), the last item starts within about 400ms of the first. Not for routine interactions.
- **Press conflict.** The source value is `scale(.96)` over 150ms. This file keeps `.97` over 120ms. Do not mix the two on one page. One element has one press owner: the shared block, except `.ui-craft-pressable`, whose inner surface scales in tactile-controls.css. The scale applies in Persuade, Experience and Operate; Read changes colour only.
- **Origin.** Set `transform-origin` toward the trigger of a popup. A centred dialog keeps the centre.

## Shared interaction block (paste first, then map to your tokens)

```css
:where(button, [role=button], a.btn, .chip, [role=tab], [role=radio], summary) {
  min-height: 44px;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease,
              box-shadow 140ms ease, transform 120ms cubic-bezier(.2,.8,.2,1);
}
:where(button, [role=button], a.btn, .chip, [role=tab], [role=radio]):where(:not(:disabled, [aria-disabled=true], .ui-craft-pressable):hover) {
  background-color: color-mix(in srgb, var(--accent) 8%, var(--surface)); /* tint only; text colour stays */
}
/* Specificity is (0,0,0) because every selector sits inside :where(), so any component rule you write wins, before or after this block.
   Filled primary and selected items: write `.btn-primary:hover` and `[aria-selected=true]:hover` yourself.
   Use a darker step of the fill and keep the text colour readable on it. Never set the same colour on both. */
:where(button, [role=button], a.btn, .chip, [role=tab], [role=radio]):where(:not(:disabled, [aria-disabled=true], .ui-craft-pressable):active) { transform: scale(.97); } /* Persuade, Experience, Operate */
:focus-visible { outline: 2px solid var(--focus, var(--accent)); outline-offset: 2px; } /* --focus: ink or a dark accent step that reaches 3:1 on every surface it sits on */
.bar > span { transform-origin: left; transition: transform 400ms cubic-bezier(.2,.8,.2,1); } /* scaleX, not width */
svg[stroke] { stroke-width: 1.75; } /* one stroke width */
h1, h2, h3 { text-wrap: balance; } p { text-wrap: pretty; max-width: 65ch; }
.theme-switching, .theme-switching * { transition: none !important; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; } }
```

The craft-floor concept and the mode and colour strategy names are adapted from Impeccable (Apache-2.0, https://github.com/pbakaus/impeccable).
Motion timings adapted from jakubkrehel/skills (MIT, https://github.com/jakubkrehel/skills, skills/better-motion).
