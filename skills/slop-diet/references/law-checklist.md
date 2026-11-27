# Preserve rules (improve mode)

Read these before you change an existing page. Each rule is a default with a reason; the brief wins. Every other rule has one home: [craft-floor.md](craft-floor.md), [layout-and-forms.md](layout-and-forms.md), [controls.md](controls.md), [ui-copywriting.md](ui-copywriting.md) and [anti-slop.md](anti-slop.md).

- C1. Every control keeps its role and accessible name (a switch stays `role="switch"`); restyle, do not swap elements. Users and tests find controls by role and name.
- C2. Every nav link stays visible at 1440 (a menu button is fine at 390), and every feature, section and text stays. Add states; remove nothing.
- C3. Brief says keep the copy: leave it, and log the copy rules it trips in `craft-overrides.json` [anti-slop.md].
