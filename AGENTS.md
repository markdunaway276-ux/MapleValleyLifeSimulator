# Maple Lane repository instructions

## Codex only

These instructions apply only to OpenAI Codex. Claude and other assistants should follow their own instructions from the user.

### Branches

- When the user asks to push Maple Lane work, push it to the GitHub `test` branch by default.
- Push, merge, cherry-pick, or otherwise update `main` only when the user explicitly authorizes updating `main` for those specific changes. A generic request to push does not authorize updating `main`.
- Report the destination branch after a push.

### Playtest previews

- For each completed game update, publish it to the GitHub `test` branch, verify that the Vercel preview for that commit is ready, and include its playable browser link in the handoff.
