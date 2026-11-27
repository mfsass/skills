# Craft floor: read just before the first write

Rules read right before editing get applied. Check each line against the plan while you write.

1. **Mode and colour.** Mode and colour strategy named in the plan. In Persuade, Experience and Operate the page shows at least two surface levels (by tint, tone, a deep band, elevation or framed panels), so it is not all white with one blue button; Read keeps calm paper (white or a light tint) and at most one tint step. Default split about 60/30/10: base neutral, supporting colour (tinted panels, a deep band), accent. The accent has four jobs only: primary action fills, the selected state (border, tint, check), key data marks and one highlight. Under restrained or committed, an accent at 0% has lost its job: give those four their fill. Never add accent as ornament. Restrained keeps the supporting colour a tinted neutral; committed makes it the brand hue at surface strength; drenched makes the brand hue the base. Accent text and buttons still meet contrast. `scripts/verify.mjs` prints the measured split against the band for your strategy (`--strategy`), as INFO (never a fail).
2. **Focal point.** One element is clearly first. In Persuade and Experience make it land first by one means that fits: an on-load entrance (300-600ms, once), scale, contrast or a live behaviour. Operate and Read need no entrance. Scroll and detail moments follow the mode table below.
3. **Signature moment.** One moment shows the product's own subject in the form the product needs: it reacts to input, runs live, or is a strong static composition (see controls.md). Name what it shows, what changes and the trigger (if any), and a static fallback that still carries the character with animation off. If it uses a control, that control is not the browser default and has press and selected states. Spend the plan's boldness here, nowhere else.
4. **Heights.** Every input, select, stepper and button in one row has the same height. Selected or bold states reserve their border and weight, so nothing moves.
5. **States.** Text keeps 4.5:1 (3:1 for text 24px+, or bold 18.66px+) in rest, hover, focus-visible, active and selected; `verify.mjs` forces each state and measures. Hover never turns text unreadable or swaps to an unrelated hue. A selected tab or chip keeps its own text colour on hover. Focus-visible ring on every control: 2px or wider and 3:1 or more against the background beside it (`verify.mjs` measures it). Error beside the field with an icon and a fix. Loading and success states for the primary action.
6. **Narrow width.** At 320: no horizontal scroll, no clipped text, no overlapping elements, targets per item 11, short labels where long ones would wrap. Multi-column layouts collapse to one column. Tables and matrices become cards.
7. **Browser surfaces.** `::selection`, `caret-color`, `accent-color` and focus ring use the palette. `font-variant-numeric: tabular-nums` on figures. One h1, no skipped heading level, a `main` landmark; invalid fields carry `aria-invalid`.
8. **Inputs best practice.** Correct `type`, `inputmode` and `autocomplete` on every field. Format phone numbers as typed. Validate email on blur. Dates before today disabled where they make no sense. Money is `type="text" inputmode="decimal"` and parses locale formats.
9. **No tells.** No glow halos, glass, rainbow or aurora gradients, gradient text, side accent bars, decorative dots, emoji icons or hype copy. Physical bevels and layered shadows on controls are fine. Real content instead of ornament.
10. **Motion.** The level fits the product, from state feedback only to one bold sequence; it is never decoration. Laws: state changes ease instead of snapping (about 120-220ms; instant selection is fine in keyboard lists), step changes show direction or continuity (a slide forward and back, a cross-fade, a progress fill), `prefers-reduced-motion` honoured. Scroll and detail moments follow the mode table below. Animate `transform` and `opacity`, not `top`, `left`, `width` or `height` (an accordion panel may animate its height with `grid-template-rows: 0fr` to `1fr`). No idle loops on Operate screens. Never `linear` easing except loaders and progress. Surface timings are in the table below.
11. **Target size, stated once.** Every interactive element is at least 44x44px at touch widths (390, 320): buttons, chips, segments, radios, checkbox labels, nav, logo and footer links, icon buttons. Use 48px for frequent actions. This holds at 1440 too: a dense Operate table may use tighter rows, but the buttons, selects and inputs in it keep a 44px box. Inline text links inside a paragraph are exempt. `verify.mjs` measures every control at 390 and buttons and form controls at 1440, and checks overlaps at both. No control sits on another one: a Show/Hide or clear button sits beside its field, and a sticky bar does not cover controls at rest. Placeholders fit at 320 (short text).
12. **Finish the brief.** Preselect a sensible default so no panel starts empty. Every action gives feedback within 400ms. Destructive actions offer Undo. Add the empty, error and success states the brief implies, and a done screen for a flow.
13. **Choice load.** At most 7 primary nav items. One primary CTA and one secondary action per section. Group metrics, fields and cards in 3-5 and separate groups with space before borders.
14. **Type, space and taste checks.** Body 16px or more, one type scale, 8pt spacing (numbers in layout-and-forms.md). Hover and press change something on every control; a segment's selected state is clear and changes in place with no layout shift (a sliding indicator is one way); the 390 layout re-flows, not shrinks; every dependent value updates with its choice.

## Scroll and detail moments by mode

Defaults; the plan's Boldness and the brief win. Floor: content is visible at rest without JavaScript (never `opacity: 0` in base CSS while waiting for a script), and everything below is off under `prefers-reduced-motion: reduce`.

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

For landing and SaaS pages that tell a data story. Motion has to show something: a value arriving, a sequence, proof. Defaults; the plan's Boldness and the brief win.

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
| Tooltip | 150ms after a 400-600ms delay (siblings under 100ms) | shorter than the enter | enters from .96-.97 |
| Dropdown, menu | 250ms | 150ms | enters from .96-.97 |
| Modal | 350-450ms | 150ms | enters from .98-.99, exits to .99 |
| Drawer, panel, sheet | 350-450ms (CSS 350ms ease-out; spring: duration .45, bounce 0) | 150ms | sheets travel up to 70% of their own size |
| Toast | 250ms (no source value; treated as a small floating element) | 150ms | as dropdown |
| Press | about 120ms | n/a | `scale(.96-.98)`, 1-4px travel, a fill or an inset. One press style per control kind, used the same way across the page (a switch thumb squash next to a button press is fine). Disabled controls never move. |

- **Easing.** `ease-out` for enters, exits and state changes (the starter's `--ease-out`, `cubic-bezier(.2,.8,.2,1)`, is one). `linear` only for loaders and progress. Springs use bounce 0.
- **Exits.** Shorter and smaller than enters, about 150ms, ease-out. One option: opacity, 4px blur and `translateY(-12px)`. A plain fade is fine.
- **Stagger.** Staged entrances and real lists only: 30-80ms apart (80ms is the ceiling), the last item starts within about 400ms of the first. Not for routine interactions.
- **Press.** Pick the press styles for the product (controls.md, Tactile feel). One press style per control kind, used the same way across the page (a switch thumb squash next to a button press is fine). For a scale press, published values run from `.96` over 150ms to `.97` over 120ms; do not mix two values on one control kind. One element has one press owner: the page's own rules, or tactile-controls.css for `.ui-craft-pressable`. Read mode often changes colour only.
- **Origin.** Set `transform-origin` toward the trigger of a popup. A centred dialog keeps the centre.

## Shared interaction block

Moved to [../assets/starter.css](../assets/starter.css), which SKILL.md loads at start. It holds fallbacks only (targets, focus, timing, reduced motion), no press or hover look.

The craft-floor concept and the mode and colour strategy names are adapted from Impeccable (Apache-2.0, https://github.com/pbakaus/impeccable).
Motion timings adapted from jakubkrehel/skills (MIT, https://github.com/jakubkrehel/skills, skills/better-motion).
