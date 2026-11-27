# Design References: Pick One Archetype or System, or Derive One

Invented palettes read as "weird colors". Defaults read as "generic". Either pick ONE archetype or system below and read only its file, or derive palette and type from the brief's own world. Either way: one neutral family, one accent, contrast checked. Do not mix two systems on one screen.

A system file copies the structure, spacing and neutrals of a public product as a block. Its own hue (Linear indigo, Stripe violet) is a placeholder: take the accent from the product's domain. The hex values approximate the public look. They are a starting kit, not the brand. Do not copy logos, names or product copy. A host `DESIGN.md` or token file always wins. All type stacks work offline (no CDN). Name the system in the plan: `Reference: Linear Dark, accent hue 158`.

## Pick by surface, then load one file

Archetypes favour pages that show the real product, data or main control, big and working. Pick the archetype first and derive the palette from the brief. Take a system instead only when the brief fits its whole look. A recipe is one worked look: keep its idea, and change any value that does not fit the product.

| Surface | Archetype (first choice) | System (if the brief fits its look) |
|---|---|---|
| Landing for a product with a UI, data or a flow | [Product as proof](systems/product-as-proof.md) | [Vercel Mono](systems/vercel-mono.md), [Stripe Light](systems/stripe-light.md) |
| Converter, calculator, configurator, pricing, booking | [Control as hero](systems/control-as-hero.md) | [Teenage Engineering / Braun](systems/teenage-engineering-braun.md), [Notion Calendar (Cron)](systems/notion-calendar.md) |
| Consumer app, onboarding, learning, habits, wallet | [Tactile chunky](systems/tactile-chunky.md) | none |
| Dashboard, ledger, triage table, admin, settings | [Calm dense operate](systems/calm-dense-operate.md) | [Linear Dark](systems/linear-dark.md), [Stripe Light](systems/stripe-light.md) |
| Docs, guide, long-read, reader | [Designed reading](systems/designed-reading.md) | [Stripe Press / Kinfolk Editorial](systems/stripe-press-kinfolk.md) |
| Command palette, launcher, keyboard tool | [Calm dense operate](systems/calm-dense-operate.md) | [Raycast Dark](systems/raycast-dark.md) |

Name the pick in the plan: `Reference: control as hero, derived (workshop bench), accent hue 28`. Do not copy a real product's look, logo or copy.

## Derive from the brief's world

When no system fits, or the brief names a material, era or place, build the tokens from it instead. Put these in the plan's Reference and Art direction lines: the physical scene (slate and amber trace for audio gear; newsprint and vermilion ink for a magazine), the neutral family it implies, one accent taken from it, and a type pairing (serif display with sans body, geometric display with mono, humanist sans). Then check every text and surface pair for contrast. The floor stays; the look is yours. Open choices: surface material and polarity, type pairing, layout shape (split, editorial column, grid, full-bleed stage, dense table), how groups separate (hairlines, tonal blocks, soft elevation, inset panels), and the accent's job.

The plan's art direction sentence comes from this scene. Test it: would the same look fit an unrelated product? If yes, revise. Surfaces must read as distinct levels, never flat white on white. Choose the means: a deep or saturated band that holds content (a summary, the focal panel, a footer), tonal panels, elevation, or a framed product field.

## Adapt the system to the prompt

The system fixes the structure. The prompt sets the personality through these four dials:

| Dial | Read from the prompt | Example |
|---|---|---|
| Accent hue | Brand name, product material, domain color | Coffee roastery: Stripe Light with a deep espresso-brown ink and a forest-green accent, not clay |
| Polarity | Where and how long the user works | Studio software at night: dark. Checkout: always light |
| Density | Expert daily use versus first visit | Triage at 1024px+: 40px rows. Marketing: 96px sections |
| Boldness | The plan's level: quiet, distinctive, showpiece | Boldness is product theatre: the product, data or main control big and working. Quiet: type and colour only. Showpiece: one hero sequence, WebGL rarely |

## When to use WebGL, Three.js or scroll choreography

Rare. WebGL, 3D toys and art-site experiments rarely help; product theatre wins. Use it only when all three are true:
1. The plan says "showpiece" and the surface is marketing or a launch.
2. The 3D or scroll scene shows the product's real subject: a room's sound field, a device, a data flow. Never abstract blobs or particles.
3. A static frame of the scene still works as the hero image, for reduced motion and slow devices.

Rules: one canvas per page. Under 60 KB of hand-written code with no CDN, or a CSS 3D transform when that is enough. Respect `prefers-reduced-motion`. Scroll scenes advance with the scroll position and never hijack the scroll. The headline stays readable over the scene at 4.5:1.

## Good versus bad, side by side

| Area | Good (passes the two-second look) | Bad (fails the look) |
|---|---|---|
| Status in a table | `Investigating` in `--ink-2`, weight 500; `Breached` in `--danger` text | 7px colored `::before` dot plus the same word |
| Option card | 2px ink border and a check icon on the selected card | Colored roast "beans" and a "Save 10%" pill on every card |
| Palette | Linear neutrals plus one indigo accent | Purple, teal, orange and pink tokens on one pricing page |
| Hero image | Top edge aligned with the headline, fixed aspect ratio, sits on the grid | Image floating mid-height next to a short paragraph |
| Section start | Heading directly on the page background | An empty colored band above the heading |
| Hero copy | "Hear the room before you build it." | "Unlock next-gen acoustic intelligence." |
| Interaction | Every control answers hover and press within about 120ms in the page's own style (a press-in, a fill, a shadow drop); totals update visibly | Hover changes nothing, or every card floats up 8px |

## Shared rules for every system

- One accent, functional jobs only: action, selection, key data mark or one highlight. Remove any use that is decoration. Do not cap the count, since the accent covers about 10% of the area (craft-floor.md).
- Neutrals carry most text; panels and the focal field carry tint.
- Status is a text label. It may also carry a semantic colour (danger, warning, ok) or a monochrome icon. Severity and category are text or weight. Never a decorative marker: no dot, blob or coloured pill that repeats the label.
- Keep the system's spacing scale. Do not add off-scale values like 13px or 22px gaps.
