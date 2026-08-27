# pi-keep-model

A [pi](https://pi.dev) extension that **keeps your active model across `/new` sessions**.

No more manually re-selecting your model every time you start a fresh session.

## How it works

1. Whenever you change the model (via `/model`, `Ctrl+P`, or the model selector), the extension saves the provider and model ID to `~/.pi/agent/preserved-model.json`.
2. When you run `/new`, the extension restores that model automatically.

**Priority order:**

- The **last selected model** (`~/.pi/agent/preserved-model.json`) wins.
- If it's unavailable (uninstalled provider, missing API key), the extension falls back to an **explicit pin** (`~/.pi/agent/model-pin.json`), if configured.

```json
// ~/.pi/agent/model-pin.json — optional, explicit default model
{ "provider": "openai-codex", "modelId": "gpt-5.6-sol" }
```

If nothing is saved and no pin is configured, pi keeps its default behavior.

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
- Optional pin: `~/.pi/agent/model-pin.json`

## License

MIT
