<h1 align="center">mfsass/skills</h1>

<p align="center"><strong>Agent skills that make coding agents follow real craft rules, then check the result.</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Node 22+" src="https://img.shields.io/badge/Node-22%2B-339933.svg">
  <a href="https://skills.sh"><img alt="skills.sh" src="https://img.shields.io/badge/skills.sh-compatible-black.svg"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude_Code-plugin-D97757.svg">
</p>

<p align="center">
  <a href="#install-any-skill">Install</a> ·
  <a href="#skills">Skills</a> ·
  <a href="#add-a-skill">Add a skill</a> ·
  <a href="#credits">Credits</a>
</p>

Each skill is its own folder and its own Claude Code plugin. Install only the ones you want.

```bash
npx skills add mfsass/skills --skill slop-diet
```

Add `-a claude-code`, `-a codex` or `-a cursor` to pick the agent.

## Install any skill

**Claude Code**

```text
/plugin marketplace add mfsass/skills
/plugin install <skill>@mfsass-skills
```

**Codex, Cursor and other agents** (with the [Skills CLI](https://skills.sh))

```bash
npx skills add mfsass/skills --skill <skill> -a codex
npx skills add mfsass/skills --skill <skill> -a cursor
npx skills add mfsass/skills --skill <skill> -a claude-code
```

Add `-g` to install for all projects. Run `npx skills add mfsass/skills --list` to see every skill.

## Skills

### [slop-diet](skills/slop-diet/README.md)

Build and refine landing pages, SaaS screens, pricing, checkout and forms without the generic AI look. The agent follows concrete design rules, then a real browser checks contrast and touch targets.

[<img src="docs/images/slop-diet/demo.gif" alt="slop-diet in 30 seconds" width="480">](skills/slop-diet/README.md)

```text
/plugin install slop-diet@mfsass-skills
```

```bash
npx skills add mfsass/skills --skill slop-diet -a codex
```

[Read more about slop-diet](skills/slop-diet/README.md)

More skills will follow.

## Add a skill

Copy the template, fill it in and add a card here. The steps are in [docs/adding-a-skill.md](docs/adding-a-skill.md).

## Credits

Licenses and what each skill adapted are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Skill-specific credits are on each skill page, for example [slop-diet](skills/slop-diet/README.md#credits).

## License

[MIT](LICENSE).
