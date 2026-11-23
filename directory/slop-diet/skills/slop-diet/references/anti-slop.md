# Anti-Slop Without Making Screens Boring

Generic AI output fails in two opposite ways:
1. **Slop:** template decoration that appears whatever the subject. Status dots, tinted pill tags, cream-and-terracotta palettes, glow halos, buzzwords.
2. **Sterile over-correction:** every strong choice deleted until the page is a grey wireframe.

Strip the first. Keep one deliberate signature move so you do not fall into the second.

## Dot ban (on by default; the brief or host design system can override it)

| ID | Tell | Replace with |
|---|---|---|
| `SLOP-STATUS-DOT` | Any small filled circle (3-20px) beside a status, tag, table row, option, legend, nav item or heading. This includes `::before` dots, `.dot`/`.led`/`.bean`/`.swatch` spans, Tailwind `h-2 w-2 rounded-full bg-*`, and `●` glyphs. | A text label (`Investigating`, weight 500, `--ink-2`). A 12-14px monochrome stroke icon. A tinted row background on the selected row. A hairline rule. Not a one-side accent bar. |

In blind votes, the author voted two outputs down for dots and passed a third narrowly with the dots as the main complaint ("ai dots", "the color dots and pill, feels sloppy"). A dot adds a color without adding meaning, and the label beside it already says the status. When the brief or the host design system asks for dots (a status page, a legend key, a presence indicator), keep them and state a one-line reason in your reply, as for the reflex checks below. Functional circles stay allowed without a reason: radio buttons, switch thumbs, slider handles, spinners, avatars, numbered step markers.

## Reflex checks (remove by default, override with a reason)

| ID | Tell | Replace with |
|---|---|---|
| `SLOP-PILL-CLUTTER` | Four or more tinted, fully rounded tags in a view (`Save 10%`, `For pour-over`, `Any brewer`). | Plain secondary text. Three pills per view at most. |
| `SLOP-CREAM-CLAY` | Warm cream page (`#F4F1EA`-ish) with a serif display and a terracotta, clay or burnt-orange accent, unless the brand or brief calls for it (a pottery or craft subject). | A reference palette from [design-references.md](design-references.md), or a palette derived from the brief's own world (materials, era, domain). |
| `SLOP-EMPTY-BAND` | A tinted block of empty color above or behind a heading ("block color room above heading"). | Start content at the top of its section. Color a band only if it holds content. |
| `SLOP-HALF-CHART` | A chart whose data fills less than 80% of its axis, or a hero visual that floats lower than the headline. | Fit the axis to the data. Top-align the visual with the headline cap height. |
| `SLOP-EYEBROW-CHROME` | A tracked ALL-CAPS mono label above every heading. Meta joined with `·`. | One eyebrow per page at most, or none. |
| `SLOP-PULSE-DOT` | `animate-ping` or glowing pulse on static content. | Nothing. Show a timestamp if data is live. |
| `SLOP-NEON-BTN-HALO` | Colored blurred `box-shadow` behind buttons. | Solid fill, crisp 1px border, `:active` press. |
| `SLOP-SPARKLE-CHROME` | ✨ 🚀 🔥 in buttons and headings. | One stroke icon family, or no icon. |
| `SLOP-AURORA-TEMPLATE` | Dark navy, purple-pink radial blobs, centered hero, two pill CTAs. | A reference palette or a palette derived from the brief's world, and an asymmetric layout. |
| `SLOP-GRADIENT-TEXT` | `background-clip: text` headline. | Solid ink. |
| `SLOP-BUZZWORDS`, `SLOP-X-NOT-Y-COPY`, `SLOP-VANITY-STATS` | "Supercharge your", "Built for X, not Y", "+420%". | The concrete verb and a sourced number, or no number. |

Check the IDs you can match in code, including `SLOP-CREAM-CLAY`. A palette derived from the brief's own world is not the tell; the tell is the same cream, serif and clay with no reason in the brief. `SLOP-STATUS-DOT` follows the same override rule. `SLOP-EMPTY-BAND`, `SLOP-HALF-CHART` and `SLOP-EYEBROW-CHROME` are judge checks. Look for them in the screenshot.

To override a reflex flag, state one line in your reply, for example: `SLOP-PILL-CLUTTER: Tag filter bar is the core interaction of this screen.`

## Do / don't from real votes

| Don't (voted down) | Do (voted up or fixed) |
|---|---|
| `● Investigating` in red, amber, blue and green | `Investigating` in `--ink-2`. Breached SLA in `--danger` text only. |
| Roast options with brown dots and `For pour-over` pills | Option card: name, origin, tasting notes. Selected card has 2px ink border and a check icon. |
| Cream page, black card, orange button, orange badge | One neutral shell. Accent marks only the active tier ring and the primary button. |
| Chart drawn 20-160 Hz on a 20 Hz-20 kHz axis, card sits 60px below the headline | Axis fits the data. Card top aligns with the headline top. |
| Colored empty band above the hero heading | Heading starts at the top of the section with 96px top padding on `--bg`. |

## The signature move (prevents "Generic / Boring")

Every screen earns ONE move that fits the domain, and everything else stays quiet:
- **Real product artifact:** a working chart, schematic, configurator or diff built in SVG or CSS, with real interaction.
- **Editorial scale:** 72-96px display set tight against 13-14px UI text.
- **Tactile controls:** keys that press down 2px and spring back.
- **Asymmetric grid:** `7fr / 5fr` with the artifact breaking the column edge.
