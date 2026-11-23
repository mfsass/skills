# Contributing

Thanks for taking a look. Bug reports, rule fixes and new skills are all welcome.

## Report a bug

Open an issue with the bug template. It asks for your agent, your OS and the output of `node scripts/verify.mjs <page>` from the skill folder, which is what makes most bugs easy to reproduce.

## Change a skill

1. Fork the repo and branch from `main`.
2. Edit the skill under `skills/<name>/`.
3. Run the checks (CI runs the same ones):

   ```bash
   node .github/scripts/check-repo.mjs
   claude plugin validate . --strict
   claude plugin validate skills/<name> --strict
   npx -y skills add . --list
   ```

4. Add a line to `CHANGELOG.md` and open a pull request. Say what changed and what you ran.

## Add a skill

Each skill is its own folder and its own Claude Code plugin, so people install only what they want. A new skill needs:

- `skills/<name>/SKILL.md` whose front matter `name` equals the folder name.
- `skills/<name>/.claude-plugin/plugin.json` with the same name and an `x.y.z` version.
- `skills/<name>/README.md` and `LICENSE`.
- An entry in `.claude-plugin/marketplace.json`, a card in the root `README.md` and a `CHANGELOG.md` section for its version.

Open an issue first if you are unsure the skill fits here.

## Rules for rules

A rule needs a number or a check someone can run. "Make it feel modern" is not a rule; "body text is 16 px or larger" is.
