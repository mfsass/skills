# Vercel Mono: high-contrast engineering marketing

One system from the [design references index](../design-references.md). The shared rules there apply.

```css
--bg:#FFFFFF; --surface:#FAFAFA; --line:#EAEAEA; --ink:#0A0A0A;
--ink-2:#444444; --muted:#666666; --accent:#0070F3; --band:#0A0A0A; --band-ink:#FAFAFA;
font-family: "Geist", "Inter", -apple-system, "Helvetica Neue", Arial, sans-serif;
--mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
```
- Scale: 64-80px hero (weight 600, -0.04em, line-height 1.0), 18px lede, 16px body, 14px UI labels.
- Grid: 12 columns, 24px gutter, visible 1px `--line` grid lines as the structure.
- Contrast band: one `--band` section (the product artifact or the closing CTA) with `--band-ink` text.
- Accent appears on links and one data line only. Buttons are ink fill or white with `--line` border, radius 6px, 44px tall.
- Motion: hover lifts nothing. It swaps the fill (`#0A0A0A` to `#333`) in 120ms. One staged entrance for the hero artifact only.
