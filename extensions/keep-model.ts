import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const STATE_DIR = join(homedir(), ".pi", "agent");
const LAST_FILE = join(STATE_DIR, "preserved-model.json");
const PIN_FILE = join(STATE_DIR, "model-pin.json");

type ModelInfo = { provider: string; modelId: string };

async function saveJson(file: string, info: ModelInfo): Promise<void> {
  try {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(info), "utf-8");
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
    await saveJson(LAST_FILE, { provider: event.model.provider, modelId: event.model.id });
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
