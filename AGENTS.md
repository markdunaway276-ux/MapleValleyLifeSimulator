# Maple Lane repository instructions

## Codex only

These instructions apply only to OpenAI Codex. Claude and other assistants should follow their own instructions from the user.

### Branches

- When the user asks to push Maple Lane work, push it to the GitHub `test` branch by default.
- Push, merge, cherry-pick, or otherwise update `main` only when the user explicitly authorizes updating `main` for those specific changes. A generic request to push does not authorize updating `main`.
- Report the destination branch after a push.

### Playtest previews

- Add a short entry at the top of `src/data/changelog.js` (bump the version) for each player-visible update so it shows in the title screen's What's New.
- For each completed game update, publish it to the GitHub `test` branch, verify that the Vercel preview for that commit is ready, and confirm the stable test URL points to that deployment. Include https://maple-lane-playtest-git-test-mark-e095.vercel.app/ in the handoff so browser saves stay on the same address.

## Gemini only (Jules, Gemini CLI, Gemini Code Assist)

These instructions apply only to Google Gemini tools. Codex and Claude follow their own rules above or from the user.

### Branches

- Push all Maple Lane work to the GitHub `gemini` branch. Never push to `main` or `test`.
- Before starting new work, update `gemini` from `main` so you build on the latest game.
- Never merge, cherry-pick, or open pull requests into `main`. Claude reviews `gemini` and moves it into `main`.
- Report the destination branch after a push.

### Working on the game

- Plain ES modules and Three.js from `vendor/three/`; no build step, no new npm packages.
- Run the unit tests with `node --test` before pushing.
- Only CC0 or CC-BY assets may be committed (credit CC-BY ones in CREDITS.md). No real brand logos.
- Add a short entry at the top of `src/data/changelog.js` (bump the version) for each player-visible update so it shows in the title screen's What's New.
- The very wide Maple Lane road is deliberate; don't change it.
