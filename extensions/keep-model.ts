import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// If true, also persists the selected model as pi's startup default
// (defaultProvider/defaultModel in ~/.pi/agent/settings.json) on every
// user-initiated model change and on exit, so the next `pi` launch starts
// on the model you were using.
const SYNC_STARTUP_DEFAULT = true;

const STATE_DIR = join(homedir(), ".pi", "agent");
const LAST_FILE = join(STATE_DIR, "preserved-model.json");
const PIN_FILE = join(STATE_DIR, "model-pin.json");
const SETTINGS_FILE = join(STATE_DIR, "settings.json");

type ModelInfo = { provider: string; modelId: string };

async function saveJson(file: string, info: ModelInfo): Promise<void> {
  try {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(info), "utf-8");
  } catch {
    // Non-critical; ignore silently
  }
}

/** Preserve the startup default (defaultProvider/defaultModel) in settings.json. */
async function persistStartupDefault(info: ModelInfo): Promise<void> {
  if (!SYNC_STARTUP_DEFAULT) return;
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(raw) as Record<string, unknown>;
    // Avoid rewriting the file (and losing formatting/other keys) when the
    // default already matches — common at startup after a prior sync.
    if (settings.defaultProvider === info.provider && settings.defaultModel === info.modelId) {
      return;
    }
    settings.defaultProvider = info.provider;
    settings.defaultModel = info.modelId;
    await writeFile(SETTINGS_FILE, `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
  } catch {
    // Non-critical; ignore silently
  }
}

async function loadJson(file: string): Promise<ModelInfo | null> {
  if (!existsSync(file)) return null;
  try {
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as ModelInfo;
    if (!parsed.provider || !parsed.modelId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function modelsEqual(a: ModelInfo, b: ModelInfo): boolean {
  return a.provider === b.provider && a.modelId === b.modelId;
}

export default function (pi: ExtensionAPI) {
  // Remember the last model selected by the user (/model, Ctrl+P cycle) so it
  // survives restarts and /new. Only user-initiated selections are recorded
  // (source "set" / "cycle"); session restores are handled below.
  pi.on("model_select", async (event) => {
    if (!event.model?.provider || !event.model?.id) return;
    if (event.source === "restore") return;
    const info = { provider: event.model.provider, modelId: event.model.id };
    await saveJson(LAST_FILE, info);
    // Make this model the startup default too, so a fresh `pi` launch (new
    // process) starts on the model you last used — not only /new sessions.
    await persistStartupDefault(info);
  });

  // On exit (Ctrl+C / Ctrl+D / quit), make the active model the startup
  // default so the next `pi` process boots on it. This covers the case where
  // you never switched models explicitly during the session.
  pi.on("session_shutdown", async (event, ctx) => {
    if (event.reason !== "quit") return;
    const current = ctx.model;
    if (!current?.provider || !current?.id) return;
    const info = { provider: current.provider, modelId: current.id };
    await persistStartupDefault(info);
  });

  // On /new, restore the LAST SELECTED model so a fresh session keeps the
  // model you were using. Falls back to the explicit pin (model-pin.json),
  // then leaves pi's default untouched.
  pi.on("session_start", async (event, ctx) => {
    if (event.reason !== "new") return;

    const candidates: Array<ModelInfo | null> = [
      await loadJson(LAST_FILE), // last selected model → takes priority
      await loadJson(PIN_FILE),  // explicit pin → fallback
    ];

    for (const info of candidates) {
      if (!info) continue;
      try {
        const model = ctx.modelRegistry?.find?.(info.provider, info.modelId);
        if (model) {
          // Avoid a pointless setModel round-trip when the new session already
          // starts on the desired model.
          const current = ctx.model;
          if (current && modelsEqual({ provider: current.provider, modelId: current.id }, info)) {
            return;
          }
          await pi.setModel(model);
          return;
        }
      } catch {
        // Model unavailable or no API key — try the next candidate.
      }
    }
  });
}
