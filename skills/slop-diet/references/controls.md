# Controls that fit the data

Pick the control from the shape of the data, not from habit. One control per screen should be clearly not a default: that is the signature control from the plan. Every control here is keyboard reachable, 44px tall on touch, and keeps its height when selected.

| Data | First choice | Why | Fallback |
|---|---|---|---|
| 2-5 exclusive options | Segmented control or chip row (`role="radiogroup"`) | All options visible, one tap | Radios |
| 2-12 multi-select (days, interests, tags) | Toggle chips in a wrapping grid, selected = filled accent with a check | Scannable, tactile | Checkboxes |
| Small quantity 1-20 | Stepper with large -/+ buttons and the number in display type, or a chip row 1-8 plus "More" | Visible limits, no typing | Number input with min and max |
| Grouped quantities | Popover with one stepper per row, a running total, rule text beside a disabled button | Rules stay visible | Separate selects |
| Date choice in the next weeks | Horizontal date strip (day name, date, availability under it), scroll-snap on touch | One tap, shows availability | Inline month calendar |
| Date range or dates with values | Month calendar grid with the value under each day, range fill between start and end | Compare at a glance | Two date inputs |
| Time slot | Grid of slot buttons grouped by period (morning, evening); booked slots struck through and disabled | Shows what is left | Select |
| Time range | Two time fields side by side with a 24h track preview, or a two-thumb range on a 24h track | Range is visible | Two selects |
| Long list (timezones, countries) | Searchable combobox: type to filter, grouped by region, recent or local first, typo tolerant, highlight the match | Fast for long lists | Native select |
| Multi-select from a long list (projects, people) | Search field plus removable tokens in the field and a grouped results list with checks | Shows what is chosen | Multi-select list |
| On/off setting | Switch with a thumb that slides 180ms and squashes slightly on press | Instant, tactile | Checkbox |
| Matrix of on/off (row x column) | Table of compact switches or checkable cells, column headers sticky, row label left; on narrow screens collapse to one card per row | Dense and scannable | List of checkboxes |
| Continuous range | Two-thumb slider with live value labels and a small histogram behind it | Shows distribution | Two number inputs |
| Rating, mood, size | Large tappable tiles with an icon or swatch and a label | Creative, fitting | Radios |
| Reorderable list | Drag handle plus up/down buttons for keyboard, the row lifts with a shadow while dragged | Works for all inputs | Up/down buttons only |
| File | Drop zone with a dashed full border, file name and size after drop, a preview, a remove button | Clear state | File input |

## Tactile feel

- Press: `transform: scale(.97)` in 120ms, ease-out, no overshoot. Timings: [craft-floor.md](craft-floor.md#motion-timing-by-surface).
- Selected: border colour plus a check icon plus a light accent tint. Reserve the border width when unselected (transparent) so nothing shifts.
- Changed values (totals, counts) cross-fade or tick in 160ms.
- Errors shake (±4px, 3 cycles, 300ms) once and show the fix text.

## Creative but fitting

The signature control should fit the domain: a dial for a bounded quantity, a day-of-week chip row for a repeating schedule, a range calendar for dates with values, a gauge for a health or progress reading. Ask "would a user of this product recognise this control at once?" (Jakob's law). If not, keep the familiar shape and add the character through colour, type and motion instead.
