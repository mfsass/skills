# Raycast Dark: keyboard-first launcher

One system from the [design references index](../design-references.md). The shared rules there apply.

```css
--bg:#0C0C0E; --surface:#161618; --raised:#1F1F22; --line:#2A2A2E;
--ink:#FFFFFF; --ink-2:#A0A0A8; --accent:#FF6363;
font-family: "Inter", -apple-system, system-ui, sans-serif; --mono: ui-monospace, "SF Mono", monospace;
```
- Scale: 14px row text in 44px rows, 12px `kbd` hints in mono with a 1px `--line` border.
- Selected row: `--raised` or accent-tinted background with the label in weight 500. Never a dot or a one-side bar.
- Motion: list selection moves instantly. The window opens with `scale(.98)` to 1 and opacity over the modal timing in craft-floor.md.
