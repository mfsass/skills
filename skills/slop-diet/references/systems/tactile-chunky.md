# Archetype: tactile chunky

One archetype from the [design references index](../design-references.md). The shared rules there apply. Palette: derive it from the brief's world, one saturated brand field plus one accent. Use it for consumer apps, onboarding, learning, habits and wallets, in Experience or Persuade.

Controls look like objects you can press. Colour is generous, shapes are friendly, and every press answers.

Recipe:
- Buttons and option tiles 48-56px tall, radius 12-16px, bold rounded sans at 17-20px.
- Hard offset shadow in a darker shade of the control's own colour: `box-shadow: 0 4px 0 <shade>`. On press, `translateY(4px)` and the shadow goes to 0 in 80-120ms. No blur, no glow.
- One saturated colour field (a page band or a card) holds the main content. White or tinted cards sit on it.
- Selected tiles fill with the accent and keep the hard shadow. Switches stay calm (controls.md).
- One playful moment tied to the task: a progress bar that fills with a short spring, a coin that drops into the wallet.

Example: a savings app onboarding. On a deep green field, three chunky goal tiles (Trip, Car, Rainy day) press down 4px when tapped. The chosen goal fills orange, and a jar drawing fills to the monthly amount as the user steps it up.
