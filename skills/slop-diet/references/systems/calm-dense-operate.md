# Archetype: calm dense operate

One archetype from the [design references index](../design-references.md). The shared rules there apply. Palette: derive it from the brief's world, restrained strategy. Use it for dashboards, ledgers, admin and settings (Operate).

Dense, quiet and exact. Colour carries meaning, never decoration.

Recipe:
- A summary band at the top holds the 3-5 numbers that matter, on its own surface level (a deep band or a tonal panel), figures in `tabular-nums`.
- Tables: 40px rows at 1024px and wider (44px on touch), sticky header, right-aligned numbers, one hairline between rows.
- Semantic colour does work: money in and money out, on time and late, each with its text label. Group or sort by the meaning that matters.
- Row click opens a side panel that slides 12px in 200ms. Keyboard: arrow keys move the row focus, Enter opens.
- Filters sit above the table as a segmented control or chips. The table keeps its width when a filter changes.

Example: a business banking ledger. The band shows Balance, In this month and Out this month. Incoming amounts are green with a `+`, outgoing are ink. A filter for Card, Transfer and Payroll slides its selection, and the row count updates in the band.
