# Layout, Type, Buttons and Forms: the Numbers

SKILL.md keeps the short version. This page holds the full rules. Read it when the page has a form, a settings layout or more than one column of controls. Host tokens always win.

**Hierarchy.** One focal point per viewport. Pass the squint test: blurred, the order of importance is still clear. Order by size, then weight, then tone. Use three text tones at most: ink, secondary, muted. Never pure black on pure white: ink is `#0A0A0A` to `#1A1A1A` on white, or a tinted neutral.

**Type scale.** Pick one ratio. Use 1.125-1.2 for dense tools, 1.25-1.333 for product pages, 1.5+ for marketing heroes. Body text is 16-18px with 1.5 line height and a 45-80 character measure (65ch default). Labels, table cells and kbd hints in dense Operate UI may be 13-15px; that is UI text, never running prose. Headings get 1.1-1.3 line height and tighter tracking as they grow. Use regular and semibold or bold weights only. Use sentence case everywhere.

**Spacing.** Use an 8pt scale (8/16/24/32/48/80), with 4pt steps only inside dense components. Space inside a group is always smaller than the space between groups: label to field 4-8px, field to next label 24px, card padding 24px, gap between cards 24-32px, page sections 80-96px. When torn between two steps, take the larger. Every column shares one left edge.

**Buttons.** One primary (filled accent) button per section or dialog. Secondary is an outline in the action color or ink. Tertiary is underlined text. Never a grey fill, which reads as disabled. Label with a verb plus a noun: "Start subscription", "Assign incident". Targets are at least 44x44px, 48px for frequent actions, with 8-16px between them (the one dense-desktop exception is in craft-floor.md, item 11). Order left to right by importance, stacked full width on mobile. Avoid disabled buttons. Validate on submit and say what is missing.

**Forms.** One column. A visible label above every input, never a placeholder as the label. Hints sit above the field. Errors sit next to the field, with an icon and a sentence that says how to fix it, and a summary at the top on submit. Mark optional fields with "(optional)". Size fields to their content: a postcode is narrow. Use radios for 5 or fewer options and a stepper with 44px+ buttons for small counts. Accept spaces and hyphens, then normalize.

**Media and framing.** Top-align a hero visual with the headline's first line. Give it a real frame: a defined aspect ratio, the same radius as other surfaces, and an edge that meets a grid line. Never let it float in leftover space. Fit chart axes to the data, so the plotted line spans at least 80% of the width. On mobile, stack the visual under the headline at full width.

**Option cards and tables.** A selected card has a 2px accent border, a check icon and a light accent tint (4-10%). Reserve the border when unselected so nothing shifts. Use tabular numbers, right-aligned, in numeric columns. Rows are 44-48px tall (40px for dense Operate tables at 1024px+, see craft-floor.md). Severity is weight and text, not a colored blob.

## Feedback and motion

The shared interaction block is in [craft-floor.md](craft-floor.md#shared-interaction-block-paste-first-then-map-to-your-tokens). Control styles are in [../assets/tactile-controls.css](../assets/tactile-controls.css); the press scale has one owner per element, see the press note in craft-floor.md. Copy rules are in [ui-copywriting.md](ui-copywriting.md).

Give changed values a visible response: a total cross-fades in 160ms, and a toggle thumb slides in 180ms. In Persuade and Experience, run one on-load entrance on the focal element (300-600ms, once); Operate and Read need none. Scroll reveals depend on the mode: Persuade and Read may reveal sections, Operate never does (table in craft-floor.md). Use WebGL or scroll choreography only when the plan says "showpiece". Surface timings are in [craft-floor.md](craft-floor.md#motion-timing-by-surface).

