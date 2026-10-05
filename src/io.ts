import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Preset } from "./types";

export function parsePresetText(text: string): Preset {
  let source = text.replace(/^\uFEFF/, "").trim();
  if (source.includes("##KUSTOMCLIP##")) {
    source =
      source
        .split("##KUSTOMCLIP##")
        .map((part) => part.trim())
        .find((part) => part.startsWith("{")) ?? source;
  }
  const data = JSON.parse(source) as Record<string, unknown>;
  if (data.preset_root && typeof data.preset_root === "object") return data as Preset;
  if (Array.isArray(data.clip_modules)) {
    return {
      preset_info: { version: 11, title: "Imported clip", width: 1080, height: 1920 },
      preset_root: { internal_type: "RootLayerModule", viewgroup_items: data.clip_modules },
    };
  }
  throw new Error("This file does not contain a KLWP preset.");
}

export function readArchive(data: Uint8Array): { preset: Preset; assets: Record<string, Uint8Array> } {
  const files = unzipSync(data);
  const entry = Object.keys(files).find((name) => name.split("/").pop() === "preset.json");
  if (!entry) throw new Error("The archive has no preset.json.");
  const preset = parsePresetText(strFromU8(files[entry]!));
  const assets: Record<string, Uint8Array> = {};
  for (const [name, bytes] of Object.entries(files)) {
    if (name !== entry) assets[name] = bytes;
  }
  return { preset, assets };
}

export function writeArchive(preset: Preset, assets: Record<string, Uint8Array>): Uint8Array {
  const entries: Record<string, Uint8Array> = { ...assets };
  entries["preset.json"] = strToU8(JSON.stringify(preset, null, 2));
  return zipSync(entries, { level: 6 });
}

export async function readFile(file: File): Promise<{ preset: Preset; assets: Record<string, Uint8Array> }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".json") || (bytes[0] === 0x7b || bytes[0] === 0xef)) {
    try {
      return { preset: parsePresetText(new TextDecoder().decode(bytes)), assets: {} };
    } catch (error) {
      if (name.endsWith(".json")) throw error;
    }
  }
  return readArchive(bytes);
}
