# Archetype: product as proof

One archetype from the [design references index](../design-references.md). The shared rules there apply. Palette: derive it from the brief's world (Derive section of the index). Use it for Persuade pages that sell a product with a UI, data or a flow.

The hero is the real product, working, at full scale. The visitor sees it run before reading a claim.

Recipe:
- Headline of 8 words or fewer above or left of the product. One primary CTA.
- The product panel takes 60% of the width or more, or runs full width under the headline. Build it in HTML, CSS and SVG with real-looking data, never a flat screenshot or a tilted device mockup.
- One live behaviour within 2 seconds of load: rows arrive, a value updates, a cursor moves, a step lights up. Static fallback: the panel in its finished state.
- The panel sits on its own surface level (a deep band, a tonal field or a framed stage), with layered shadow or a crisp edge, not glow.
- Below the hero, 3 proof sections. Each pairs one real UI fragment or flow diagram with one sentence. A diagram highlights its steps in order as it scrolls into view.

Example: a landing page for a build tool. The hero shows a deploy log that streams 12 lines, then the status label changes from `Building` to `Ready` in green text, and the preview URL appears. Under it, a three-node diagram (push, build, preview) lights each node as its log line arrives.
