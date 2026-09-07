# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-09-07

### Changed

- The last selected model is now forced on **every** session start (`startup`,
  `resume`, `/new`, `fork`), not only `/new`. Pi restores the model recorded
  inside an old session branch on resume, which could differ from the model the
  user last chose; the extension now overrides it so a fresh `pi` process boots
  on the model the user actually used last.

### Fixed

- On exit, the active model is now also written to `preserved-model.json`
  (previously only the startup default in `settings.json` was updated), keeping
  both files consistent.
- Placeholder model identities (`"unknown"`) are ignored everywhere, so a boot
  without a resolvable model can no longer overwrite the saved default with
  `defaultProvider: "unknown"` / `defaultModel: "unknown"`.

## [1.2.0] - 2026-09-07

### Added

- The active model is now persisted as pi's **startup default**
  (`defaultProvider` / `defaultModel` in `~/.pi/agent/settings.json`) whenever
  the user selects a model via `/model` or `Ctrl+P` model cycling.
- On exit (`session_shutdown`, reason `"quit"`), the active model is persisted
  as the startup default, so the next `pi` process boots on the model you were
  using — not only `/new` sessions.

### Changed

- `preserved-model.json` (last selected model) is now updated on every
  user-initiated model change, matching the startup-default sync.
- Session restores (`model_select` with source `"restore"`) are **excluded**
  from startup-default sync, so resuming an old session does not overwrite the
  user's chosen default.

### Fixed

- Previously the model was only kept across `/new` sessions; quitting pi and
  starting a fresh process fell back to the `defaultProvider`/`defaultModel`
  from `settings.json` (or the restored session model), making the extension
  appear to "lose" the selected model on restart.

## [1.1.0] - 2026-08-27

### Added

- Optional explicit model pin via `~/.pi/agent/model-pin.json`. The pin is used
  as a fallback when the last selected model (`preserved-model.json`) is
  unavailable (uninstalled provider, missing API key).

### Changed

- Priority order on `/new`: last selected model wins, then the explicit pin,
  then pi's default behavior.

## [1.0.0] - 2026-07-29

### Added

- Initial release. Keeps the active model across `/new` sessions by saving the
  last selected provider/model to `~/.pi/agent/preserved-model.json` and
  restoring it on each new session.

[Unreleased]: https://github.com/Anhydrite/pi-keep-model/compare/9982ebf...HEAD
[1.3.0]: https://github.com/Anhydrite/pi-keep-model/compare/07d2477...9982ebf
[1.2.0]: https://github.com/Anhydrite/pi-keep-model/compare/e2fc39b...3552f04
[1.1.0]: https://github.com/Anhydrite/pi-keep-model/compare/772fb7a...e2fc39b
[1.0.0]: https://github.com/Anhydrite/pi-keep-model/commit/772fb7a
