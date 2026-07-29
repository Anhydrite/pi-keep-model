# pi-keep-model

A [pi](https://pi.dev) extension that **keeps your active model across `/new` sessions**.

No more manually re-selecting your model every time you start a fresh session.

## How it works

1. Whenever you change the model (via `/model`, `Ctrl+P`, or the model selector), the extension saves the provider and model ID to `~/.pi/agent/preserved-model.json`.
2. When you run `/new`, the extension reads the saved file and restores that model automatically.

If the saved model is no longer available (e.g. you uninstalled a provider), it silently falls back to the default.

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

Saved state: `~/.pi/agent/preserved-model.json`

## License

MIT
