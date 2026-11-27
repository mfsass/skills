# Stripe Light: trustworthy transactional clarity

One system from the [design references index](../design-references.md). The shared rules there apply.

```css
--bg:#F6F9FC; --surface:#FFFFFF; --line:#E3E8EE; --ink:#0A2540;
--ink-2:#425466; --muted:#697386; --accent:#635BFF; --accent-ink:#FFFFFF;
--ok:#0E6245; --danger:#DF1B41; --band:#0A2540; --band-ink:#FFFFFF;
font-family: -apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
--mono: ui-monospace, "SF Mono", Menlo, monospace;
```
- Scale: 16px body, 13px labels (weight 500, sentence case), 28px title (weight 600, -0.015em), 40px total amounts with `tabular-nums`.
- Spacing 8/12/16/24/32/48. Inputs 44px tall, radius 6px, 1px `--line` border, focus `0 0 0 3px rgba(99,91,255,.25)` plus `--accent` border.
- Surfaces: white card on `--bg`, shadow `0 1px 1px rgba(10,37,64,.04), 0 4px 12px rgba(10,37,64,.06)`.
- Contrast band: `--band` behind the order summary or the footer, `--band-ink` text.
- Selected option: 2px `--accent` border, a 16px check icon and a light accent tint. No tag pill.
- Motion: button press `scale(.97)` in 120ms. Total amount cross-fades in 160ms when it changes.
