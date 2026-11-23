# Security

Skills run with your agent's permissions, so read a skill before you install it.

## What the skills here run

- `slop-diet` ships Node scripts in `skills/slop-diet/scripts/`. `verify.mjs` starts a local headless browser (Playwright, Chrome or Edge), opens the file or URL you pass, and writes screenshots to `ui-capture/`. The scripts make no network requests of their own and send no telemetry. They have no npm dependencies; Playwright is used only if you already have it.

## Report a vulnerability

Please report privately through GitHub: **Security → Report a vulnerability** on this repo. Do not open a public issue. I aim to reply within a week.
