# Controls that fit the data

Pick the control from the shape of the data, not from habit. When the plan's signature moment uses a control, make that control clearly not a default. Keep standard form controls familiar. Every control here is keyboard reachable, 44px tall on touch, and keeps its height when selected.

| Data | First choice | Why | Fallback |
|---|---|---|---|
| 2-5 exclusive options | Segmented control or chip row (`role="radiogroup"`) | All options visible, one tap | Radios |
| 2-12 multi-select (days, interests, tags) | Toggle chips in a wrapping grid; selected differs by more than colour (a fill, a check or a border) | Scannable, tactile | Checkboxes |
| Small quantity 1-20 | Stepper with large -/+ buttons and the number in display type, or a chip row 1-8 plus "More" | Visible limits, no typing | Number input with min and max |
| Grouped quantities | Popover with one stepper per row, a running total, rule text beside a disabled button | Rules stay visible | Separate selects |
| Date choice in the next weeks (on a phone brief, always a custom picker, never the native input) | Horizontal date strip (day name, date, availability under it), scroll-snap on touch | One tap, shows availability | Inline month calendar |
| Date range or dates with values | Month calendar grid with the value under each day, range fill between start and end | Compare at a glance | Two date inputs |
| Time slot (custom on a phone brief) | Grid of slot buttons grouped by period (morning, evening); booked slots struck through and disabled | Shows what is left | Select |
| Time range | Two time fields side by side with a 24h track preview, or a two-thumb range on a 24h track | Range is visible | Two selects |
| Long list (timezones, countries) | Searchable combobox: type to filter, grouped by region, recent or local first, typo tolerant, highlight the match | Fast for long lists | Native select |
| Multi-select from a long list (projects, people) | Search field plus removable tokens in the field and a grouped results list with checks | Shows what is chosen | Multi-select list |
| On/off setting | Switch with a thumb that slides (about 150-200ms); a slight squash on press is one option; calm: no bounce, glow or colour burst | Instant, tactile | Checkbox |
| Matrix of on/off (row x column) | Table of compact switches or checkable cells, column headers sticky, row label left; on narrow screens collapse to one card per row | Dense and scannable | List of checkboxes |
| Continuous range | Two-thumb slider with live value labels and a small histogram behind it | Shows distribution | Two number inputs |
| Rating, mood, size | Large tappable tiles with an icon or swatch and a label | Creative, fitting | Radios |
| Reorderable list | Drag handle plus up/down buttons for keyboard, the row lifts with a shadow while dragged | Works for all inputs | Up/down buttons only |
| File | Drop zone with a dashed full border, file name and size after drop, a preview, a remove button | Clear state | File input |

## Tactile feel

Tactile means every control answers the hand at once. It does not mean 3D. The laws are fixed; the style is yours.

- Press: a visible change within about 100ms, no overshoot, disabled controls never move. Choose the style for the product: a press-in (`scale(.96-.98)`), 1-4px travel with a shadow drop, a darker fill, or an inset. One press style per control kind, used the same way across the page (a switch thumb squash next to a button press is fine). Timings: [craft-floor.md](craft-floor.md#motion-timing-by-surface).
- Selected: differs by more than colour alone, for example a border plus a check, a solid fill, or a tint plus a weight change. Reserve the border width when unselected (transparent) so nothing shifts.
- Changed values (totals, counts) update visibly: a cross-fade, a tick, a short count or a brief highlight, about 150-200ms.
- Errors show the fix text beside the field. An attention cue is optional (one short shake, a colour flash, an icon) and is off under reduced motion.
- Delete and remove controls stay neutral at rest and turn red on hover and focus (hue 345-15). A delete or discard that loses data opens a dialog with a red confirm button that names the action ("Delete 3 incidents"). Cancel is neutral and holds focus.

## Creative but fitting

A signature control should fit the domain: a dial for a bounded quantity, a day-of-week chip row for a repeating schedule, a range calendar for dates with values, a gauge for a health or progress reading. Ask "would a user of this product recognise this control at once?" (Jakob's law). If not, keep the familiar shape and add the character through colour, type and motion instead.

For standard controls, start from the pattern people know (a search bar, a square toggle, a data table) and change one thing inside it: the shape of the selected state, one custom icon, or one measured motion. Do not replace the pattern.
