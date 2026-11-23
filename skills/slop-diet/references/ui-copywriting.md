# UI Copywriting and Microcopy

Generated copy fails the same way generated visuals do: it is generic, inflated and could sit on any product. A reviewer reads "Unlock 10x velocity" and stops trusting the whole screen. Write copy that only this product could use.

## Five rules

1. **Name the domain object.** The headline says what the product does to what thing, for whom. "Hear the room before you build it" (acoustics). "Every open incident, worst first" (ops). "Fresh-roasted beans, every two weeks" (coffee).
2. **Lead with the fact.** Put the key word or number first in headings, buttons, list items and links. Cut "In order to", "Would you like to", "There are".
3. **Use real numbers and units.** "Ships in 2 days", "P95 412 ms", "€14 per 250 g bag". Never invent impressive stats. If no number is known, describe the mechanism instead.
4. **Verb plus noun on every action.** "Start subscription", "Assign to me", "Run simulation", "Clear filters". Never "Submit", "Go", "Learn more" or "Click here".
5. **One word per concept.** If it is a "subscription", it is never also a "plan" or "membership" on the same screen. Keep sentence case everywhere.

## Banned phrases (lint-checked where possible)

| Pattern | Why it fails | Write instead |
|---|---|---|
| Unlock, Supercharge, Elevate your, Unleash | Promise with no mechanism | The mechanism: "Simulates reflections up to 8 kHz" |
| Next-gen, Cutting-edge, State-of-the-art, World-class, Revolutionary | Self-praise | The concrete difference: "Renders in 40 ms in the browser" |
| Seamless, Effortless, Magic | Hides the real effort | What the user does: "Import a floor plan as PDF" |
| Built for X, not Y / Not just another Z / It isn't X. It's Y. | Rhetorical formula, instantly recognizable | A direct claim about X |
| 10x, +420%, 10,000+ happy teams | Unsourced vanity number | A sourced figure, or none |
| ✨ 🚀 🔥 as chrome | Template decoration | No icon, or one monochrome icon |

## Microcopy by element

| Element | Good | Bad |
|---|---|---|
| Hero headline | "Every open incident, worst first" | "Next-gen incident intelligence" |
| Sub-headline | One sentence: who, what, the proof. 15-25 words. | Three stacked benefit fragments |
| Primary CTA | "Start subscription", "Book a demo room" | "Get started →", "Unlock now" |
| Secondary CTA | "See sample report" | "Learn more" |
| Form label | "Postcode" | "Enter your postcode here" |
| Hint (above field) | "Spaces and hyphens are fine" | Tooltip icon with the same text |
| Inline error | "Enter a 4-5 digit postcode, for example 2100" | "Invalid input!" / "Oops, something went wrong" |
| Empty state | "No incidents match P1 in eu-west. Clear filters" | "Nothing here yet ✨" |
| Confirmation | "Subscription started. First bag ships Thursday 26 Nov." | "Success!" |
| Destructive confirm | "Delete 3 incidents? This cannot be undone." + "Delete incidents" | "Are you sure?" + "OK" |
| Status label | "Investigating", "Mitigated", "Resolved" in text | A colored dot with no word |

## Tone checks before you ship

- Read the headline out loud. Could a competitor use it unchanged? Rewrite it.
- Count adjectives in the hero. More than two? Replace them with a fact.
- Every button: does it say what happens next?
- Every error: does it say how to fix it, without blame and without "please" or "sorry"?
- Numbers: numerals, thousands separators, real units, tabular figures in tables.
