# Adding a skill

Each skill is a folder under `skills/` and also its own Claude Code plugin, so people install only the skill they want. `templates/skill/` holds a starting point.

1. Copy the template and rename every `your-skill-name` to the real name (lowercase, hyphens):

   ```bash
   cp -R templates/skill skills/<name>
   ```

2. Fill in `skills/<name>/SKILL.md`. The front matter needs `name` (same as the folder) and `description`. Put scripts, references and a `LICENSE` in the same folder, because the folder is what gets installed. Keep `SKILL.md` as the entry point.
3. Fill in `skills/<name>/.claude-plugin/plugin.json`. Agents the skill ships go in `skills/<name>/agents/*.md` with `name` and `description` front matter. Claude Code finds them on its own.
4. Fill in `skills/<name>/README.md`. This is the skill's page: hero line, demo, what it does, install, credits.
5. Put images and demos in `docs/images/<name>/`, not in the skill folder, so they are not installed with the skill. Link them from the README with `../../docs/images/<name>/...`.
6. Add the skill to `plugins` in `.claude-plugin/marketplace.json`: `{ "name": "<name>", "source": "./skills/<name>", "description": "...", "category": "...", "tags": [...] }`.
7. Add a card to the "Skills" section of the root `README.md`: name, one line, thumbnail, install line and a link to the skill page.
8. Check it:

   ```bash
   claude plugin validate . --strict
   claude plugin validate skills/<name> --strict
   npx -y skills add . --list
   ```

The Skills CLI finds every `skills/*/SKILL.md` on its own, so `npx skills add mfsass/skills --skill <name>` works with no extra step. `templates/` is outside `skills/` and is not in the marketplace, so neither the CLI nor Claude Code lists it.

## The directory edition

`directory/slop-diet/` is a separate edition for the Claude plugin directory, which refuses code files from unverified publishers. It carries only Markdown, JSON, YAML and PNG, and keeps the script checks as hand checks in `references/without-scripts.md`. When you change `skills/slop-diet/`, make the matching change there. `claude plugin validate directory/slop-diet --strict` prints one warning about the `icon` field; the directory portal reads that field, so leave it.
