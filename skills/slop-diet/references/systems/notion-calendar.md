# Notion Calendar (Cron): precise time and scheduling

One system from the [design references index](../design-references.md). The shared rules there apply.

```css
--bg:#FFFFFF; --surface:#F7F7F5; --line:#E9E9E7; --ink:#191919;
--ink-2:#5F5E5B; --muted:#9B9A97; --accent:#2383E2; --now:#E03E3E;
font-family: "Inter", -apple-system, "SF Pro Text", system-ui, sans-serif;
```
- Scale: 12px time gutter in `--muted`, 13px event titles weight 500, 22px date header.
- Events are solid blocks in a light tint of their calendar color with ink text, radius 4px. The only line in red is the "now" rule.
- Keyboard-first: every action has a `kbd` hint. Drag snaps to 15-minute steps with a 120ms ease.
