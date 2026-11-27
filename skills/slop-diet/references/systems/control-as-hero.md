# Archetype: control as hero

One archetype from the [design references index](../design-references.md). The shared rules there apply. Palette: derive it from the brief's world (Derive section of the index). Use it for converters, calculators, configurators, booking and pricing, in Persuade or Experience.

The hero is one working control. Using it is the pitch.

Recipe:
- Put the control in the hero at 1.5 to 2 times normal size, prefilled with a sensible default, so the result shows before any input.
- The result is in display type (48-72px, `tabular-nums`) and updates within 100ms of each input, with a 160ms tick or cross-fade.
- One line under the result explains it: the fee, the rate, the arrival time, what is included.
- The control is built for the data (controls.md): a stepper, a segmented choice, a searchable select. Its selected and pressed states are designed.
- The panel that holds the control is the contrast band or the focal tint. Everything else on the page stays calm and supports it.

Example: a money transfer page. The hero holds "You send 1,000 EUR" and "They get 1,083.40 USD" in 56px figures, a currency combobox with search, and the line "Fee 4.12 EUR, arrives Thursday". Changing the amount ticks both figures and the arrival line within 100ms.
