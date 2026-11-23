# Law checklist: run it before the final verify

Each line is one check, numbered C1 to Cn. Mark each applies or N/A for this page. Fix every line that applies and fails, then run `verify.mjs` again. Report `Checklist: X/N applied, Y N/A, Z fixed`. The file in brackets holds the detail. Each rule is a default with a reason; the brief wins.

## Preserve (improve mode)
- C1. Every control keeps its role and accessible name (a switch stays `role="switch"`); restyle, do not swap elements. Users and tests find controls by role and name.
- C2. Every nav link stays visible at 1440 (a menu button is fine at 390), and every feature, section and text stays. Add states; remove nothing.
- C3. Brief says keep the copy: leave it, and log the copy rules it trips in `craft-overrides.json` [anti-slop.md].

## Plan and colour
- C4. Mode and colour strategy are named, and the strategy is derived from the brief's world when the brief has one [craft-floor.md].
- C5. In Persuade, Experience and Operate, at least two surfaces carry tint, so the page is not white with one blue button; Read may stay white paper [craft-floor.md].
- C6. Area splits about 60/30/10 as base / supporting / accent for your strategy (`verify.mjs` prints the band); under drenched the accent may be small [craft-floor.md].
- C7. The accent sits on primary actions, selection, key data marks and one highlight, not on decoration. Under restrained or committed, an accent at 0% is a bug [craft-floor.md].
- C8. One focal point per viewport, and no more than three text tones.
- C9. No pure black on pure white (ink `#0A0A0A` to `#1A1A1A`).
- C10. At most 7 nav items; groups of 3-5 [layout-and-forms.md].
- C11. One accent hue with its tints, taken from a reference or from the brief's own world; no five-hue palette [design-references.md].

## Type and copy
- C12. Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`, body `max-width: 65ch` (45-80 characters).
- C13. Real punctuation: curly quotes, en dash for ranges (9–5), `…`. Not in code or attributes.
- C14. Long file names truncate in the middle and keep the extension visible (`report-fin….pptx`).
- C15. `font-variant-numeric: tabular-nums` on prices, counts and tables; numeric columns right-aligned.
- C16. One scale ratio; body 16-18px at line height 1.5; sentence case [layout-and-forms.md].
- C17. The headline names the domain object and leads with the fact; real numbers and units, none invented [ui-copywriting.md].
- C18. Every action is verb plus noun (not "Submit", "Learn more"); one word per concept [ui-copywriting.md].
- C19. Errors say the fix, with no "please" or "sorry"; empty states offer the next action [ui-copywriting.md].
- C20. No banned phrases (Unlock, Supercharge, Seamless, "X, not Y") unless kept per brief [ui-copywriting.md].

## Look and layout
- C21. Text keeps 4.5:1 (3:1 for large text, 3:1 for disabled) in every state: hover, focus, pressed, selected, loading. `verify.mjs` measures it.
- C22. A selected tab, chip or segment keeps readable text on hover.
- C23. Every control shows a focus ring of 3:1 or more against its background beside it, 2px or wider (`verify.mjs` measures it) [craft-floor.md].
- C24. One filled primary per section (pricing too), an outline secondary, never a grey fill [layout-and-forms.md].
- C25. Targets are at least 44x44px at 390: logo, nav and footer links, chips, segments, radios, checkbox labels, icon buttons; inline text links exempt; the dense Operate desktop exception only as in [craft-floor.md].
- C26. No two targets overlap at 390.
- C27. 8pt spacing, tighter inside groups than between; every column shares one left edge [layout-and-forms.md].
- C28. Controls in one row share one height (44-48px); selected states reserve border and weight, so nothing shifts [craft-floor.md].
- C29. At 320: no sideways scroll, clipping or overlap; columns collapse to one, tables become cards, placeholders are short [craft-floor.md].
- C30. Hero visual is top-aligned with the headline and framed (ratio, radius, grid edge); chart data fills 80% of its axis [layout-and-forms.md].
- C31. One h1, no skipped heading level, heading sizes step down, a main landmark.

## Controls and forms
- C32. One signature control that is not a browser default and fits the data; it has press and selected states [controls.md].
- C33. Selected option: border, check and a 4-10% tint, with the border width reserved when unselected [controls.md].
- C34. Forms: one column, a visible label above each field (never a placeholder), "(optional)" marked, field width fits the content [layout-and-forms.md].
- C35. Correct `type`, `inputmode` and `autocomplete` per field; validate on blur [craft-floor.md].
- C36. Invalid fields carry `aria-invalid` and a message beside the field.
- C37. `::selection`, `caret-color`, `accent-color` and focus ring use the palette; all line icons share one stroke width [craft-floor.md].

## Motion and states
- C38. Persuade and Experience: one on-load entrance on the focal element (300-600ms, once). Operate and Read need none.
- C39. Stagger steps are 30-80ms and the last item starts within about 400ms of the first, on real lists only [craft-floor.md].
- C40. Scroll and detail moments match the mode (Persuade, Read: reveals; Experience: one product moment; Operate: none).
- C41. Content is visible without JS, and movement is off under reduced motion [craft-floor.md].
- C42. In Persuade, Experience and Operate, buttons and pressable cards press with `:active { transform: scale(.97); }`, disabled never scales, and one element has one press owner. Read changes colour only.
- C43. Animate transform and opacity only (accordion height is the exception); bars use `scaleX`; never `transition: all` or `linear`.
- C44. Exits are faster than enters [timings](craft-floor.md#motion-timing-by-surface); a tooltip opens after 400-600ms, siblings under 100ms.
- C45. The accordion panel height animates (`grid-template-rows: 0fr -> 1fr`); a theme switch runs no colour transitions (`.theme-switching`).
- C46. An invalid submit shakes (±4px, 3 cycles, 300ms) or fades the message in; the toggle knob slides on a real `role="switch"`.
- C47. Hover keeps or raises contrast; the primary action has loading and success states.
- C48. `prefers-reduced-motion: reduce` turns movement into opacity or none.

## UX laws
- C49. Miller: more than 7 options get groups or search [controls.md].
- C50. Doherty: every click shows a change within 400ms ("Copied" with a check, spinner then result, Undo after clear).
- C51. Postel: money is `type="text" inputmode="decimal"` and parses locale formats; phones accept spaces and dashes.
- C52. Hick and Fitts: one obvious next step near the eye; a default is preselected, so no panel starts empty.
- C53. Empty, error, success and done states exist; destructive actions offer Undo.

## AI tells [anti-slop.md]
- C54. No decorative status dots (text label or icon), no more than three pills per view, no side accent bars.
- C55. No gradient text, glow, glass or aurora backgrounds, emoji icons, `→` on every button, ALL-CAPS eyebrows or empty tinted band above a heading.
- C56. No cream-plus-clay palette unless the brief or its world calls for it [anti-slop.md].

## Motion with purpose (landing and SaaS data pages)
- C57. Scroll motion has a job (a data story, proof figures, a sequence) and the page has at most one signature scroll moment; Operate screens have none [craft-floor.md#motion-with-purpose].
- C58. Every line, bar, figure and label is in the HTML at rest; hidden start states exist only under `html.js` and never above the fold, and reduced motion shows the final state.
- C59. Line draw uses `pathLength="1"` and `stroke-dashoffset` (800-1200ms); bars use `scaleY` or `scaleX`; count-up runs once, uses `tabular-nums`, and keeps the real value in the HTML (at most 4 per page).
