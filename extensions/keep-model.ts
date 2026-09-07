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

/** Guard against placeholder/empty model identities (e.g. no auth at boot). */
function isValidModel(info: ModelInfo | null | undefined): info is ModelInfo {
  if (!info) return false;
  const p = info.provider?.trim();
  const m = info.modelId?.trim();
  if (!p || !m) return false;
  if (p === "unknown" || m === "unknown") return false;
  if (m.endsWith("/unknown") || m.includes("unknown")) return false;
  return true;
}

async function saveJson(file: string, info: ModelInfo): Promise<void> {
  try {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(info), "utf-8");
  } catch {
    // Non-critical; ignore silently
  }
}

/** Persist the model as the "last selected" (used at next session start). */
async function saveLastModel(info: ModelInfo): Promise<void> {
  if (!isValidModel(info)) return;
  await saveJson(LAST_FILE, info);
}

/** Preserve the startup default (defaultProvider/defaultModel) in settings.json. */
async function persistStartupDefault(info: ModelInfo): Promise<void> {
  if (!SYNC_STARTUP_DEFAULT) return;
  if (!isValidModel(info)) return;
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
    if (!isValidModel(parsed)) return null;
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
  // (source "set" / "cycle"); model switches caused purely by pi restoring an
  // old session are handled in the session_start handler below.
  pi.on("model_select", async (event) => {
    if (!isValidModel({ provider: event.model?.provider, modelId: event.model?.id })) return;
    if (event.source === "restore") return;
    const info = { provider: event.model.provider, modelId: event.model.id };
    await saveLastModel(info);
    // Make this model the startup default too, so a fresh `pi` launch (new
    // process) starts on the model you last used — not only /new sessions.
    await persistStartupDefault(info);
  });

  // On exit (Ctrl+C / Ctrl+D / quit), record the active model as both the
  // "last selected" and the startup default so the next `pi` process boots on
  // it — even if it was never switched explicitly during the session.
  pi.on("session_shutdown", async (event, ctx) => {
    if (event.reason !== "quit") return;
    const current = ctx.model;
    if (!isValidModel({ provider: current?.provider, modelId: current?.id })) return;
    const info = { provider: current.provider, modelId: current.id };
    await saveLastModel(info);
    await persistStartupDefault(info);
  });

  // On EVERY session start (fresh boot, resume of an existing session, /new,
  // fork), force the LAST SELECTED model so pi never boots on a model that was
  // recorded inside an old session branch. Priority: last selected model
  // (preserved-model.json) → explicit pin (model-pin.json) → pi's default.
  pi.on("session_start", async (event, ctx) => {
    const candidates: Array<ModelInfo | null> = [
      await loadJson(LAST_FILE), // last selected model → takes priority
      await loadJson(PIN_FILE),  // explicit pin → fallback
    ];

    for (const info of candidates) {
      if (!info) continue;
      try {
        const model = ctx.modelRegistry?.find?.(info.provider, info.modelId);
        if (!model) continue;
        // Avoid a pointless setModel round-trip when the session already
        // starts on the desired model (e.g. pi restored it from the session).
        const current = ctx.model;
        if (current && isValidModel({ provider: current.provider, modelId: current.id })) {
          if (modelsEqual({ provider: current.provider, modelId: current.id }, info)) {
            return;
          }
        }
        await pi.setModel(model);
        return;
      } catch {
        // Model unavailable or no API key — try the next candidate.
      }
    }
  });
}
