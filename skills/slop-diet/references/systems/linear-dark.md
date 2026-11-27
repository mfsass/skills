# Linear Dark: calm operational density

One system from the [design references index](../design-references.md). The shared rules there apply.

```css
--bg:#08090A; --surface:#101113; --raised:#16171A; --line:#23252A;
--ink:#F7F8F8; --ink-2:#B4B6BC; --muted:#8A8F98; --accent:#5E6AD2;
--danger:#EB5757; --ok:#4CB782;
font-family: "Inter", -apple-system, "SF Pro Text", system-ui, sans-serif;
font-feature-settings: "cv11", "ss01"; --mono: ui-monospace, "SF Mono", Menlo, monospace;
```
- Scale: 13px UI labels, 14px table and row text (Operate dense UI, not running prose), 20px page title (weight 600, -0.01em). Rows 40px at 1024px+ (Operate exception in craft-floor.md), 44px at touch widths. Spacing 4/8/12/16/24/32.
- Radius 6px controls, 8px panels. One-pixel `--line` borders, no shadows on dark.
- Status: text label in `--ink-2` plus a 12px monochrome stroke icon. Severity as plain text weight (`P1` bold `--ink`, `P2` regular `--ink-2`). Semantic colour (`--danger`, `--ok`) only on the status text that needs it, such as a breach.
- Motion: hover background `--raised` in 140ms. Panel slides 12px plus opacity in 350ms `cubic-bezier(.2,.8,.2,1)` (drawer row in craft-floor.md).
