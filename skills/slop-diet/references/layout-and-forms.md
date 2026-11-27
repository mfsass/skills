# Layout, Type, Buttons and Forms: the Numbers

SKILL.md keeps the short version. This page holds the full rules. Read it when the page has a form, a settings layout or more than one column of controls. Host tokens always win.

**Hierarchy.** One focal point per viewport. Pass the squint test: blurred, the order of importance is still clear. Order by size, then weight, then tone. Use three text tones at most: ink, secondary, muted. Never pure black on pure white: ink is `#0A0A0A` to `#1A1A1A` on white, or a tinted neutral.

**Type scale.** Pick one ratio. Use 1.125-1.2 for dense tools, 1.25-1.333 for product pages, 1.5+ for marketing heroes. Body text is 16-18px with 1.5 line height and a 45-80 character measure (65ch default). Labels, table cells and kbd hints in dense Operate UI may be 13-15px; that is UI text, never running prose. Headings get 1.1-1.3 line height and tighter tracking as they grow. Use regular and semibold or bold weights only. Use sentence case everywhere.

**Spacing.** Use an 8pt scale (8/16/24/32/48/80), with 4pt steps only inside dense components. Space inside a group is always smaller than the space between groups: label to field 4-8px, field to next label 24px, card padding 24px, gap between cards 24-32px, page sections 80-96px. When torn between two steps, take the larger. Every column shares one left edge.

**Buttons.** One primary button per section or dialog, clearly the strongest (usually a filled accent). Secondary is weaker, for example an outline in the action color or ink. Tertiary is weaker again, for example underlined text. Never a grey fill, which reads as disabled. Label with a verb plus a noun: "Start subscription", "Assign incident". Keep 8-16px between targets (sizes in craft-floor.md, item 11). Order left to right by importance, stacked full width on mobile. Two side-by-side calls to action have equal width (`flex: 1` or two equal grid columns), the same height and an 8-16px gap, and align with the content they act on. The first is primary and the second secondary: never two filled buttons of equal weight. Avoid disabled buttons. If a submit finds a missing field, focus the first one and say what is missing. Show the result inside the button by default (spinner, then "Saved" with a check for 1.5s, same width throughout); use a toast only for an async or global result.

**Forms.** One column. Hints sit above the field. Validate on blur and format as the user types (craft-floor.md, items 5 and 8). On submit add a summary at the top. Mark optional fields with "(optional)". Size fields to their content: a postcode is narrow. Use radios for 5 or fewer options and a stepper with 44px+ buttons for small counts. Accept spaces and hyphens, then normalize.

**Media and framing.** In a split hero, top-align the visual with the headline's first line. Give it a real frame: a defined aspect ratio, the same radius as other surfaces, and an edge that meets a grid line. Never let it float in leftover space. Fit chart axes to the data, so the plotted line spans at least 80% of the width. On mobile, stack the visual under the headline at full width. No dead space: no empty band above a hero image and no empty area under a row of KPI cards; size the cards to their content or fill the row.

**Cards and radii.** Never put a card inside a card: group with spacing first, then a tint step, then a full border. Radii are concentric: the inner radius equals the outer radius minus the padding (a 16px card with 8px padding holds 8px corners).

**Stress-test the content.** Try each text slot with a 1-character string and an 80-character unbroken string, and with the media missing. Nothing clips, overlaps or scrolls sideways at 320 and 390px (use `overflow-wrap: anywhere`, `min-width: 0` and a line clamp). Reserve space for the worst-case text: the longest label, total or translated string fits without a shift. A price and its period (`€24 / month`) never wrap apart (`white-space: nowrap`). Sheets and dialogs fit inside the viewport at 320 and 390: `max-height: 100dvh` minus the safe area, the body scrolls, and the action row stays visible.

**Option cards and tables.** A selected card differs by more than colour: for example a 2px accent border with a check icon, a light accent tint (4-10%) with a check, or a solid fill. Reserve the border when unselected so nothing shifts. Use tabular numbers, right-aligned, in numeric columns. Rows are 44-48px tall; a dense Operate table at 1024px+ may use 40px rows, but its buttons and inputs keep a 44px box (craft-floor.md, item 11). Severity is weight and text, never a decorative marker.

**Dashboards and tables tell one thing.** Write the one sentence the screen must tell before you build it ("3 incidents are urgent"). Carry it with more than a label: group rows by severity, give each status a semantic colour (danger, warning, ok) and always its text label, never a decorative marker, and add one line that states the target. In a table, good and bad read apart without reading the text.

## Feedback and motion

The shared interaction block is [../assets/starter.css](../assets/starter.css). Control styles are in [../assets/tactile-controls.css](../assets/tactile-controls.css); each element has one press owner, see the press note in craft-floor.md. Copy rules are in [ui-copywriting.md](ui-copywriting.md).

Give changed values a visible response, for example a total that cross-fades or ticks in about 160ms and a toggle thumb that slides in about 180ms. Entrances, scroll reveals and surface timings are in [craft-floor.md](craft-floor.md#motion-timing-by-surface).

When a choice changes (date, plan, quantity, plant), every dependent value (price, count, total, preview) updates in the same interaction. Test each one by changing the choice.

