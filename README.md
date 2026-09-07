# pi-keep-model

A [pi](https://pi.dev) extension that **keeps your active model** — across `/new` sessions **and** across restarts (as pi's startup default).

No more manually re-selecting your model every time you start a fresh session or relaunch pi.

## How it works

1. Whenever you change the model (via `/model`, `Ctrl+P`, or the model selector), the extension saves the provider and model ID to `~/.pi/agent/preserved-model.json` **and** updates the startup default (`defaultProvider` / `defaultModel`) in `~/.pi/agent/settings.json`.
2. At **every** session start (fresh launch, resume, `/new`, fork), the extension forces the last selected model — so even if an old session recorded a different model, pi boots on the model you used last.
3. When you **quit** pi, the active model is persisted as the startup default, so the next `pi` process boots on the model you were using.

**Priority order:**

- The **last selected model** (`~/.pi/agent/preserved-model.json`) wins.
- If it's unavailable (uninstalled provider, missing API key), the extension falls back to an **explicit pin** (`~/.pi/agent/model-pin.json`), if configured.

```json
// ~/.pi/agent/model-pin.json — optional, explicit default model
{ "provider": "openai-codex", "modelId": "gpt-5.6-sol" }
```

If nothing is saved and no pin is configured, pi keeps its default behavior.

> **Note:** Session restores (`/resume`, startup on an existing session) are excluded from the startup-default sync, so resuming an old session does not overwrite the default you chose.

## Install

```bash
pi install git:github.com/Anhydrite/pi-keep-model
```

Then `/reload` or restart pi.

## Usage

Nothing to do — it just works.

1. Pick your model once with `/model` or `Ctrl+P`.
2. Use `/new` as usual.
3. The same model is automatically selected in the new session.

## Files

- Saved state: `~/.pi/agent/preserved-model.json`
- Startup default (synced): `~/.pi/agent/settings.json` → `defaultProvider` / `defaultModel`
- Optional pin: `~/.pi/agent/model-pin.json`

## Disabling the startup-default sync

Set `SYNC_STARTUP_DEFAULT` to `false` at the top of `extensions/keep-model.ts` to keep the model across `/new` sessions only, without touching `settings.json`.

## License

MIT
