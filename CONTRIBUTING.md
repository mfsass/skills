# Contributing

Thanks for taking a look. Bug reports, rule fixes and new skills are all welcome.

## Report a bug

Open an issue with the bug template. It asks for your agent, your OS and the output of `node scripts/verify.mjs <page>` from the skill folder, which is what makes most bugs easy to reproduce.

## Change a skill

1. Fork the repo and branch from `main`.
2. Edit the skill under `skills/<name>/`. If you change `slop-diet`, make the same change in `directory/slop-diet/` (the edition with no code files) where it applies.
3. Run the checks:

   ```bash
   claude plugin validate . --strict
   claude plugin validate skills/<name> --strict
   npx -y skills add . --list
   ```

   `directory/slop-diet` prints one warning about the `icon` field. That is expected.
4. Add a line to `CHANGELOG.md` and open a pull request. Say what changed and what you ran.

## Add a skill

Follow [docs/adding-a-skill.md](docs/adding-a-skill.md). Each skill is its own folder and its own Claude Code plugin, so people install only what they want.

## Rules for rules

A rule needs a number or a check someone can run. "Make it feel modern" is not a rule; "body text is 16 px or larger" is.
