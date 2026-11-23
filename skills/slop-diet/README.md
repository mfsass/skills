<p align="center"><sub><a href="../../README.md">mfsass/skills</a> / slop-diet</sub></p>

<h1 align="center">slop-diet</h1>

<p align="center"><strong>Makes coding agents follow UI and UX design laws, then checks the page in a real browser.</strong></p>

<p align="center">
  <a href="../../LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Node 22+" src="https://img.shields.io/badge/Node-22%2B-339933.svg">
  <a href="https://skills.sh"><img alt="skills.sh" src="https://img.shields.io/badge/skills.sh-compatible-black.svg"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude_Code-plugin-D97757.svg">
</p>

<img src="../../docs/images/slop-diet/demo.gif" alt="slop-diet in 30 seconds: an agent builds a page, the skill applies design laws, the page passes its checks" width="100%">

Agents skip the basic UI and UX laws, so you fix the same things every time: low-contrast text, tiny tap targets, a page that breaks at 320px, hype copy, neon gradients. **slop-diet** gives the agent concrete rules for spacing, type, contrast, touch targets and motion, picks a design direction for your product's domain, then runs scripts that check the finished page in a real browser.

```bash
npx skills add mfsass/skills --skill slop-diet
```

Works with Claude Code, Codex and Cursor.

## Install

**Claude Code**

```text
/plugin marketplace add mfsass/skills
/plugin install slop-diet@mfsass-skills
```

**Codex, Cursor and other agents** (with the [Skills CLI](https://skills.sh))

```bash
npx skills add mfsass/skills --skill slop-diet -a codex
npx skills add mfsass/skills --skill slop-diet -a cursor
```

This copies the skill to `.agents/skills/slop-diet`, where Codex and Cursor read it. Add `-g` to install for all projects. Use `-a claude-code` to install without the plugin (`.claude/skills`).

<details>
<summary><strong>Manual copy</strong></summary>

Copy this folder (`skills/slop-diet/`) into `.agents/skills/` (Codex, Cursor) or `.claude/skills/` (Claude Code). It carries its own `LICENSE` and `THIRD_PARTY_NOTICES.md`.

</details>

> [!TIP]
> After installing, try: `Build a pricing page for my invoicing app`

## Why I built it

Ask any coding agent for a landing page and you can spot that an agent made it: a pulsing dot next to a "New" pill, a purple-to-blue gradient, glassy cards with a glow, five accent colours, an ALL-CAPS eyebrow over every heading, an arrow on every button, emoji standing in for icons. Under the look, the basics fail: grey-on-white text below 4.5:1, 20px tap targets, a layout that scrolls sideways on a phone.

"Make it look good" doesn't fix that, because it isn't a rule. So I wrote the rules down with numbers, and added scripts so the agent has to prove the page passes before it says it's done.

## What it does

- **Your pages pass the basics.** Contrast and touch-target checks run in a real browser, and the agent fixes what fails.
- **Real design rules.** Spacing, type and colour follow concrete numbers, with a look that fits your product.
- **No AI tells.** Hype copy, pulsing dots and neon gradients stay out.
- **Motion with a purpose.** Animation never hides content.
- **Your brief wins.** If you ask for something a rule bans, the skill follows you.

## The rules, in numbers

| Area | Rule |
|---|---|
| Touch targets | 44 x 44 px or larger at 390 px wide, and no two targets overlap |
| Contrast | 4.5:1 for text in every state: rest, hover, focus and active |
| Focus | A visible ring of 3:1 contrast and at least 2 px |
| Type | Body 16 to 18 px, line height 1.5, lines of 45 to 80 characters |
| Spacing | An 8 pt scale, tighter inside a group than between groups |
| Widths | Nothing overlaps, clips or scrolls sideways at 320, 390 and 1440 px |
| Colour | About 60 / 30 / 10 of the area as base / supporting / accent |
| Structure | One `h1`, no skipped heading levels, a `main` landmark, 7 nav links or fewer |
| Motion | Content shows without JavaScript and stops animating under reduced motion |
| Feedback | Every click answered within 400 ms, and Undo for destructive actions |

The full list is the numbered checklist in [`references/law-checklist.md`](references/law-checklist.md).

## Before and after

![A typical AI-style coffee landing page and budgeting dashboard, and the same pages refined with slop-diet](../../docs/images/slop-diet/before-after.png)

<sub>Before: a typical AI-style page, generated to show the usual tells. After: Claude Opus refining that exact page with slop-diet. Best of two identical runs per page, no hand edits.</sub>

## How it compares

We put slop-diet head to head with the leading front-end skills: [Impeccable](https://github.com/pbakaus/impeccable), [taste-skill](https://github.com/Leonxlnx/taste-skill) and Anthropic's [`frontend-design`](https://github.com/anthropics/skills). In our tests it followed the UI and UX laws most consistently.

### By the numbers

Same prompts, same model (Claude Haiku), against taste-skill, Impeccable and `frontend-design`:

- **11 to 14% higher** on our design-law checks than each of them.
- **Touch targets pass in all 4 builds.** The others scored 20 to 44% on the touch-target check.
- **Fewer floor failures:** 1 of 4 builds, against 4 of 4 for every other skill.

On Haiku, slop-diet costs more per build than Impeccable and `frontend-design`, so we make no cost claim.

<details>
<summary>How we measured</summary>

Four prompts (dashboard, landing page, refine an existing page, video product page), one sealed headless build per prompt and skill, on Claude Haiku and Claude Sonnet, scored on a strict rubric: 16 scripted checks (contrast in every state, touch targets, focus rings, overflow at 320, 390 and 1440 px, heading structure, content visible without JavaScript, AI tells) and 2 judge items. The rubric is our own and the data is private, so read this as a signal, not a ranking. Measured on slop-diet 0.3.0 and not re-run since.

</details>

## What it runs

The checks run on your machine. `scripts/verify.mjs` starts a headless Playwright, Google Chrome or Microsoft Edge, opens the file or URL you give it, and writes screenshots to `ui-capture/`. The scripts make no network requests of their own and send no telemetry; the browser loads only the page you point it at. Without a browser it still lints, and says plainly that nothing in the browser was checked. Read the scripts in [`scripts/`](scripts/) before you run them.

## Credits

Licenses and what was adapted are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) in this folder.

- [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus (Apache-2.0). Mode names, colour vocabulary, craft-floor idea.
- Adham Dannaway, product designer and author of Practical UI. UI design guidance that shaped the rules.
- [Anthropic `frontend-design`](https://github.com/anthropics/skills). Clusters of default AI choices.
- [jakubkrehel/skills](https://github.com/jakubkrehel/skills) (MIT). Motion timings and easing values.
- [Emil Kowalski's design engineering work](https://github.com/emilkowalski/skills) (MIT). Motion ideas.
- [Laws of UX](https://lawsofux.com), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/). Checklist numbers.
