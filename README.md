<h1 align="center">mfsass/skills</h1>

<p align="center"><strong>Agent skills that make coding agents follow real craft rules, then check the result.</strong></p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Node 22+" src="https://img.shields.io/badge/Node-22%2B-339933.svg">
  <a href="https://skills.sh"><img alt="skills.sh" src="https://img.shields.io/badge/skills.sh-compatible-black.svg"></a>
  <img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude_Code-plugin-D97757.svg">
</p>

<p align="center">
  <a href="#slop-diet">slop-diet</a> ·
  <a href="#install">Install</a> ·
  <a href="#credits">Credits</a>
</p>

## slop-diet

Build and refine landing pages, SaaS screens, pricing, checkout and forms without the generic AI look. The agent follows concrete UI and UX design laws, then a real browser checks the finished page.

[<img src="docs/images/slop-diet/demo.gif" alt="slop-diet in 30 seconds" width="100%">](skills/slop-diet/README.md)

[Read more about slop-diet](skills/slop-diet/README.md): what it does, before and after, and how it compares.

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

Add `-g` to install for all projects.

More skills are coming.

## Credits

Licenses and what each skill adapted are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Skill credits are on the [slop-diet page](skills/slop-diet/README.md#credits).

## License

[MIT](LICENSE).
