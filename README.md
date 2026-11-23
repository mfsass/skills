<h1 align="center">mfsass/skills</h1>

<p align="center"><strong>Agent skills that make AI-built interfaces look designed, not generated.</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Node 22+" src="https://img.shields.io/badge/Node-22%2B-339933.svg">
  <a href="https://skills.sh"><img alt="skills.sh" src="https://img.shields.io/badge/skills.sh-compatible-black.svg"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude_Code-plugin-D97757.svg">
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#before-and-after">Before and after</a> ·
  <a href="#credits">Credits</a>
</p>

<img src="docs/images/demo.gif" alt="slop-diet in 30 seconds: an agent builds a page, the skill applies design laws, the page passes its checks" width="100%">

**slop-diet** is for people who build UIs with Claude Code, Cursor or Codex and keep getting the same generic, AI-looking page. It gives the agent clear design rules, then checks the finished page.

## Install

```bash
npx skills add mfsass/skills
```

That works for Cursor, Codex and most other agents. Other ways to install:

<details>
<summary><strong>Claude Code plugin</strong></summary>

```text
/plugin marketplace add mfsass/skills
/plugin install mfsass-skills@mfsass-skills
```

</details>

<details>
<summary><strong>Cursor, Codex and other agents</strong></summary>

Use the [Skills CLI](https://skills.sh):

```bash
npx skills add mfsass/skills
```

</details>

<details>
<summary><strong>Manual copy</strong></summary>

Copy `skills/slop-diet/` into your agent's skills folder. The folder carries its own `LICENSE` and `THIRD_PARTY_NOTICES.md`, so a copy of the folder alone keeps the notices.

</details>

> [!TIP]
> After installing, try: `Build a pricing page for my invoicing app`

## What it does

- **Your pages pass the basics.** Contrast and touch-target checks run in a real browser, and the agent fixes what fails.
- **Real design rules.** Spacing, type and colour follow concrete numbers instead of a vague sense of taste.
- **A direction that fits your product.** The agent picks a proven look for your domain, not a generic default.
- **No AI tells.** Hype copy, pulsing dots and neon gradients stay out.
- **Motion with a purpose.** Animation never hides content.
- **Your brief wins.** If you ask for something a rule bans, the skill follows you.

## Before and after

![A typical AI-style coffee landing page and budgeting dashboard, and the same pages refined with slop-diet](docs/images/before-after.png)

<sub>Before: a typical AI-style page, generated to show the usual tells. After: Claude Opus refining that exact page with slop-diet. Best of two identical runs per page, no hand edits.</sub>

## How it compares

We tested slop-diet side by side with Anthropic's [`frontend-design`](https://github.com/anthropics/skills), [Impeccable](https://github.com/pbakaus/impeccable), [jakubkrehel/skills](https://github.com/jakubkrehel/skills) and the [Practical UI](https://www.practical-ui.com) book. It was the most consistent at passing accessibility basics like contrast and touch targets. It also works well on small, cheap models.

## Skills in this repo

| Skill | Use it to |
|---|---|
| [`slop-diet`](skills/slop-diet/SKILL.md) | Build or refine landing pages, SaaS screens, pricing, checkout and forms without the generic AI look. |

More skills will be added here.

## Credits

Licenses and what was adapted are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

- [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus (Apache-2.0). Mode names, colour strategy vocabulary and the craft-floor idea.
- [Practical UI](https://www.practical-ui.com) by Adham Dannaway. Ideas only. No text is copied.
- [Anthropic `frontend-design` skill](https://github.com/anthropics/skills). The clusters of default AI choices that the AI-tells list avoids.
- [jakubkrehel/skills](https://github.com/jakubkrehel/skills) (MIT). Motion timings and easing values.
- [Emil Kowalski's design engineering work](https://github.com/emilkowalski/skills) (MIT). Motion ideas.
- [Laws of UX](https://lawsofux.com), [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/). The numbers in the checklist follow them.

## License

[MIT](LICENSE).
