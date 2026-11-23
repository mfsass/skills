# Design References: Pick One Proven System, or Derive One

Invented palettes read as "weird colors". Defaults read as "generic". Pick ONE reference below, copy its structure, spacing and neutrals as a block, and take the accent hue from the product's domain. Or derive palette and type from the brief's own world (see "Derive from the brief's world" below). Either way: one neutral family, one accent, contrast checked. The reference's own hue (Linear indigo, Stripe violet) is a placeholder, not a recommendation. Do not mix two references on one screen.

The hex values approximate the public look of each product. They are a starting kit, not the brand. Do not copy logos, names or product copy. A host `DESIGN.md` or token file always wins over this page.

All type stacks work offline (no CDN). Name the reference in your first plan line: `Reference: Linear Dark, accent hue 158`.

## Pick by surface

| Surface | First choice | Second choice |
|---|---|---|
| Ops console, triage table, dev tool | Linear Dark | Vercel Mono |
| Checkout, billing, forms, fintech | Stripe Light | Vercel Mono |
| Pricing, configurator, hardware, audio | Teenage Engineering / Braun | Raycast Dark |
| Marketing hero for a technical product | Vercel Mono | Stripe Light |
| Long-read, research, editorial launch, lifestyle brand | Stripe Press / Kinfolk Editorial | Stripe Light |
| Command palette, launcher, keyboard tool | Raycast Dark | Linear Dark |
| Calendar, scheduling, booking, timeline | Notion Calendar (Cron) | Linear Dark |

## Linear Dark: calm operational density

```css
--bg:#08090A; --surface:#101113; --raised:#16171A; --line:#23252A;
--ink:#F7F8F8; --ink-2:#B4B6BC; --muted:#8A8F98; --accent:#5E6AD2;
--danger:#EB5757; --ok:#4CB782;
font-family: "Inter", -apple-system, "SF Pro Text", system-ui, sans-serif;
font-feature-settings: "cv11", "ss01"; --mono: ui-monospace, "SF Mono", Menlo, monospace;
```
- Scale: 13px UI labels, 14px table and row text (Operate dense UI, not running prose), 20px page title (weight 600, -0.01em). Rows 40px at 1024px+ (Operate exception in craft-floor.md), 44px at touch widths. Spacing 4/8/12/16/24/32.
- Radius 6px controls, 8px panels. One-pixel `--line` borders, no shadows on dark.
- Status: text label in `--ink-2` plus a 12px monochrome stroke icon. Severity as plain text weight (`P1` bold `--ink`, `P2` regular `--ink-2`). Color only for `--danger` text on breach.
- Motion: hover background `--raised` in 140ms. Panel slides 12px plus opacity in 350ms `cubic-bezier(.2,.8,.2,1)` (drawer row in craft-floor.md).

## Stripe Light: trustworthy transactional clarity

```css
--bg:#F6F9FC; --surface:#FFFFFF; --line:#E3E8EE; --ink:#0A2540;
--ink-2:#425466; --muted:#697386; --accent:#635BFF; --accent-ink:#FFFFFF;
--ok:#0E6245; --danger:#DF1B41;
font-family: -apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
--mono: ui-monospace, "SF Mono", Menlo, monospace;
```
- Scale: 16px body, 13px labels (weight 500, sentence case), 28px title (weight 600, -0.015em), 40px total amounts with `tabular-nums`.
- Spacing 8/12/16/24/32/48. Inputs 44px tall, radius 6px, 1px `--line` border, focus `0 0 0 3px rgba(99,91,255,.25)` plus `--accent` border.
- Surfaces: white card on `--bg`, shadow `0 1px 1px rgba(10,37,64,.04), 0 4px 12px rgba(10,37,64,.06)`.
- Selected option: 2px `--accent` border, a 16px check icon and a light accent tint. No tag pill.
- Motion: button press `scale(.97)` in 120ms. Total amount cross-fades in 160ms when it changes.

## Vercel Mono: high-contrast engineering marketing

```css
--bg:#FFFFFF; --surface:#FAFAFA; --line:#EAEAEA; --ink:#0A0A0A;
--ink-2:#444444; --muted:#666666; --accent:#0070F3;
font-family: "Geist", "Inter", -apple-system, "Helvetica Neue", Arial, sans-serif;
--mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
```
- Scale: 64-80px hero (weight 600, -0.04em, line-height 1.0), 18px lede, 16px body, 14px UI labels.
- Grid: 12 columns, 24px gutter, visible 1px `--line` grid lines as the structure.
- Accent appears on links and one data line only. Buttons are ink fill or white with `--line` border, radius 6px, 44px tall.
- Motion: hover lifts nothing. It swaps the fill (`#0A0A0A` to `#333`) in 120ms. One staged entrance for the hero artifact only.

## Teenage Engineering / Braun: tactile hardware

```css
--bg:#E4E4E0; --surface:#F2F2EF; --panel:#1C1C1C; --line:#C9C9C4;
--ink:#141414; --ink-2:#4A4A47; --accent:#FF5A00; --accent-ink:#141414;
font-family: "Helvetica Neue", "Neue Haas Grotesk Text", Arial, sans-serif;
--mono: ui-monospace, "SF Mono", Menlo, monospace;
```
- Neutral cool-grey shell, never cream. Use the orange in ONE role: the active control (selected tier ring, toggle on, primary key). Nothing else is orange.
- Scale: 56px tier prices (weight 500, tabular-nums), 16px body, 12px mono specs.
- Controls read as physical keys: 48px tall, radius 10px, inset `0 -2px 0 rgba(0,0,0,.18)` on rest. On press it removes the inset and moves `translateY(2px)` and scales `.97` in 120ms, ease-out. It releases in 140ms, ease-out, with no overshoot.
- Highlighted tier: `--panel` dark card with `--surface` text. It is not a second accent color.

## Stripe Press / Kinfolk Editorial: book-grade reading

```css
--bg:#FFFFFF; --surface:#F4F4F2; --ink:#111111; --ink-2:#3D3D3D;
--muted:#6B6B6B; --line:#DADADA; --accent:#1F3A93;
font-family (display): "Iowan Old Style", "Charter", ui-serif, Georgia, serif;
font-family (body): -apple-system, "SF Pro Text", system-ui, sans-serif;
```
- White paper and true ink. Do not use cream, terracotta or clay accents unless the brand or brief calls for them. They read as the generic AI palette when nothing in the brief asks for them.
- Scale: 72-96px serif display (weight 400, -0.02em), 18px body with 1.6 line-height and 65ch measure.
- One deep ink accent for links and figure numbers. Images sit on the text grid and share its left edge.
- Kinfolk variant for lifestyle and food brands: large full-bleed photography with generous white margins, a quiet grotesk for UI, and photos that carry the color. The UI stays monochrome.

## Raycast Dark: keyboard-first launcher

```css
--bg:#0C0C0E; --surface:#161618; --raised:#1F1F22; --line:#2A2A2E;
--ink:#FFFFFF; --ink-2:#A0A0A8; --accent:#FF6363;
font-family: "Inter", -apple-system, system-ui, sans-serif; --mono: ui-monospace, "SF Mono", monospace;
```
- Scale: 14px row text in 44px rows, 12px `kbd` hints in mono with a 1px `--line` border.
- Selected row: `--raised` or accent-tinted background with the label in weight 500. Never a dot or a one-side bar.
- Motion: list selection moves instantly. The window opens with `scale(.98)` to 1 and opacity over the modal timing in craft-floor.md.

## Notion Calendar (Cron): precise time and scheduling

```css
--bg:#FFFFFF; --surface:#F7F7F5; --line:#E9E9E7; --ink:#191919;
--ink-2:#5F5E5B; --muted:#9B9A97; --accent:#2383E2; --now:#E03E3E;
font-family: "Inter", -apple-system, "SF Pro Text", system-ui, sans-serif;
```
- Scale: 12px time gutter in `--muted`, 13px event titles weight 500, 22px date header.
- Events are solid blocks in a light tint of their calendar color with ink text, radius 4px. The only line in red is the "now" rule.
- Keyboard-first: every action has a `kbd` hint. Drag snaps to 15-minute steps with a 120ms ease.

## Adapt the reference to the prompt

The reference fixes the structure. The prompt sets the personality. Adjust these four dials, and nothing else:

| Dial | Read from the prompt | Example |
|---|---|---|
| Accent hue | Brand name, product material, domain color | Coffee roastery: Stripe Light with a deep espresso-brown ink and a forest-green accent, not clay |
| Polarity | Where and how long the user works | Studio software at night: dark. Checkout: always light |
| Density | Expert daily use versus first visit | Triage at 1024px+: 40px rows. Marketing: 96px sections |
| Ambition | Is the screen a tool or a stage? | Tool: one short entrance on the focal element, no hero sequence. Stage: one hero sequence, optional WebGL |

## Derive from the brief's world

When no reference fits, or the brief names a material, era or place, build the tokens from it instead. Write four lines before any markup: the physical scene (slate and amber trace for audio gear; newsprint and vermilion ink for a magazine), the neutral family it implies, one accent taken from it, and a type pairing (serif display with sans body, geometric display with mono, humanist sans). Then check every text and surface pair for contrast. The floor stays; the look is yours. Open choices: surface material and polarity, type pairing, layout shape (split, editorial column, grid, full-bleed stage, dense table), how groups separate (hairlines, tonal blocks, soft elevation, inset panels), and the accent's job.

## When to use WebGL, Three.js or scroll choreography

Use it only when all three are true:
1. The plan says "showpiece" and the surface is marketing or a launch.
2. The 3D or scroll scene shows the product's real subject: a room's sound field, a device, a data flow. Never abstract blobs or particles.
3. A static frame of the scene still works as the hero image, for reduced motion and slow devices.

Rules: one canvas per page. Under 60 KB of hand-written code with no CDN, or a CSS 3D transform when that is enough. Respect `prefers-reduced-motion`. Scroll scenes advance with the scroll position and never hijack the scroll. The headline stays readable over the scene at 4.5:1.

## Good versus bad, side by side

| Area | Good (passes the two-second look) | Bad (voted down) |
|---|---|---|
| Status in a table | `Investigating` in `--ink-2`, weight 500 | 7px colored `::before` dot plus the same word |
| Option card | 2px ink border and a check icon on the selected card | Colored roast "beans" and a "Save 10%" pill on every card |
| Palette | Linear neutrals plus one indigo accent | Purple, teal, orange and pink tokens on one pricing page |
| Hero image | Top edge aligned with the headline, fixed aspect ratio, sits on the grid | Image floating mid-height next to a short paragraph |
| Section start | Heading directly on the page background | An empty colored band above the heading |
| Hero copy | "Hear the room before you build it." | "Unlock next-gen acoustic intelligence." |
| Interaction | Press moves 1px and scales .97 in 120ms, totals cross-fade | Hover changes nothing, or every card floats up 8px |

## Shared rules for every reference

- One accent, one job: action, selection, key data mark or one highlight. Each use must have that job; remove any that is decoration. Do not cap the count, since the accent covers about 10% of the area (craft-floor.md).
- Neutrals carry most text; panels and the focal field carry tint. Status, severity and category are text, weight, or a monochrome icon.
- Keep the reference's spacing scale. Do not add off-scale values like 13px or 22px gaps.
