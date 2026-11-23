<h1 align="center">mfsass/skills</h1>

<p align="center"><strong>Agent skills that make coding agents follow real craft rules, then check the result.</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <a href="https://github.com/mfsass/skills/actions/workflows/validate.yml"><img alt="validate" src="https://github.com/mfsass/skills/actions/workflows/validate.yml/badge.svg"></a>
  <a href="https://skills.sh/mfsass/skills"><img alt="skills.sh" src="https://img.shields.io/badge/skills.sh-listed-black.svg"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude_Code-plugin-D97757.svg">
</p>

These are the skills I use when I build with coding agents. Each one turns a craft I care about into rules with numbers, plus scripts that check the agent actually followed them. "Make it look good" is not a rule. "Text contrast is 4.5:1 in every state" is.

Each skill is its own folder and its own Claude Code plugin, so you install only what you want. They work with Claude Code, Codex and Cursor.

## Quick start

```bash
npx skills add mfsass/skills --skill slop-diet
```

That copies the skill into your project, where you can read and edit it. To get updates through Claude Code instead, use the plugin:

```text
/plugin marketplace add mfsass/skills
/plugin install slop-diet@mfsass-skills
```

<details>
<summary><strong>Pick an agent, install for all projects, or see every skill</strong></summary>

```bash
npx skills add mfsass/skills --skill slop-diet -a codex        # Codex
npx skills add mfsass/skills --skill slop-diet -a cursor       # Cursor
npx skills add mfsass/skills --skill slop-diet -a claude-code  # Claude Code, without the plugin
npx skills add mfsass/skills --skill slop-diet -g              # every project
npx skills add mfsass/skills --list                            # every skill in this repo
npx skills update                                              # pull the latest versions
```

Pick one install per agent. The plugin and a copied skill together give you the same skill twice.

</details>

## Skills

### [slop-diet](skills/slop-diet/README.md)

Makes coding agents follow UI and UX design laws, then checks the page in a real browser. For landing pages, SaaS screens, pricing, checkout and forms.

[<img src="docs/images/slop-diet/demo.gif" alt="slop-diet in 30 seconds: an agent builds a page, the skill applies design laws, the page passes its checks" width="480">](skills/slop-diet/README.md)

Against Impeccable, taste-skill and Anthropic's `frontend-design`, on the same prompts with the same model (Claude Haiku), it scored 11 to 14% higher on our design-law checks. [How we measured](skills/slop-diet/README.md#how-it-compares).

```bash
npx skills add mfsass/skills --skill slop-diet
```

More skills will follow. [Watch the repo](https://github.com/mfsass/skills/subscription) or star it to hear when they land.

## Trust

Skills run with your agent's permissions. Here, every script is plain Node with no npm dependencies, makes no network requests of its own and sends no telemetry. [SECURITY.md](SECURITY.md) lists what each skill runs. CI checks the manifests and runs the checks against a broken page on every push.

## Contributing

Bug reports, sharper rules and new skills are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

Licenses and what each skill adapted are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Skill-specific credits are on each skill page, for example [slop-diet](skills/slop-diet/README.md#credits).

## License

[MIT](LICENSE).
