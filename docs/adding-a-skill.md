# Adding a skill

Each skill is a folder under `skills/` and also its own Claude Code plugin, so people install only the skill they want.

1. Create `skills/<name>/SKILL.md`. The front matter needs `name` (same as the folder) and `description`. Put scripts, references and a `LICENSE` in the same folder, because the folder is what gets installed.
2. Create `skills/<name>/.claude-plugin/plugin.json`:

   ```json
   {
     "name": "<name>",
     "version": "0.1.0",
     "description": "One sentence.",
     "author": { "name": "mfsass", "url": "https://github.com/mfsass" },
     "license": "MIT",
     "skills": ["./"]
   }
   ```

   Agents the skill ships go in `skills/<name>/agents/*.md` with `name` and `description` front matter. Claude Code finds them on its own.
3. Add the skill to `plugins` in `.claude-plugin/marketplace.json`: `{ "name": "<name>", "source": "./skills/<name>", "description": "..." }`.
4. Add a row to the table in `README.md`.
5. Check it:

   ```bash
   claude plugin validate . --strict
   claude plugin validate skills/<name> --strict
   npx -y skills add . --list
   ```

The Skills CLI finds every `skills/*/SKILL.md` on its own, so `npx skills add mfsass/skills --skill <name>` works with no extra step.
