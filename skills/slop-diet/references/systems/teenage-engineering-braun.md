# Teenage Engineering / Braun: tactile hardware

One system from the [design references index](../design-references.md). The shared rules there apply.

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
