import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const STATE_DIR = join(homedir(), ".pi", "agent");
const STATE_FILE = join(STATE_DIR, "preserved-model.json");

type ModelInfo = { provider: string; modelId: string };

async function saveModelInfo(provider: string, modelId: string): Promise<void> {
  try {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify({ provider, modelId } as ModelInfo), "utf-8");
  } catch {
    // Non-critical; ignore silently
  }
}

async function loadModelInfo(): Promise<ModelInfo | null> {
  if (!existsSync(STATE_FILE)) return null;
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as ModelInfo;
    if (!parsed.provider || !parsed.modelId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI) {
  // 1. Keep the saved model up to date whenever the user changes model
  pi.on("model_select", async (event) => {
    if (!event.model?.provider || !event.model?.id) return;
    await saveModelInfo(event.model.provider, event.model.id);
  });

  // 2. On /new (session_start reason "new"), restore the last active model
  pi.on("session_start", async (event, ctx) => {
    if (event.reason !== "new") return;

    const saved = await loadModelInfo();
    if (!saved) return;

    try {
      const model = ctx.modelRegistry?.find?.(saved.provider, saved.modelId);
      if (model) {
        await pi.setModel(model);
      }
    } catch {
      // Model no longer available — keep the default
    }
  });
}
