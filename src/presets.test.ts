import assert from "node:assert/strict";
import test from "node:test";
import { builtinTools, formulaSnippets } from "./advanced/tools";
import { defaultDevice } from "./device";
import { layoutPreset } from "./layout";
import { presetCatalog } from "./presets";
import type { KModule } from "./types";

const measure = (text: string, size: number) => {
  const lines = text.split("\n");
  const width = Math.max(1, ...lines.map((line) => line.length * size * 0.5));
  return { w: width, h: lines.length * size * 1.2 };
};

function walk(mod: KModule, visit: (item: KModule) => void) {
  visit(mod);
  for (const child of mod.viewgroup_items ?? []) walk(child, visit);
}

test("the preset menu has five distinct wallpapers", () => {
  const catalog = presetCatalog();
  assert.deepEqual(
    catalog.map((entry) => entry.id),
    ["harbor", "glass", "forecast", "lumen", "atlas"],
  );
  for (const entry of catalog) {
    const preset = entry.build();
    assert.equal(preset.preset_info?.title, entry.title);
    assert.ok((preset.preset_root.viewgroup_items ?? []).length >= 4, entry.id);
    const scene = layoutPreset(preset, defaultDevice(new Date(2026, 9, 5, 21, 5, 0)), { measure });
    assert.ok(scene.some((node) => node.text.length > 0 && !node.text.includes("⚠")), entry.id);
  }
});

test("glass plays music and forecast reads the week", () => {
  const glass = presetCatalog().find((entry) => entry.id === "glass")!.build();
  const forecast = presetCatalog().find((entry) => entry.id === "forecast")!.build();
  const events: string[] = [];
  walk(glass.preset_root, (item) => {
    for (const event of item.internal_events ?? []) events.push(String(event.action));
  });
  assert.ok(events.includes("MUSIC"));
  const formulas: string[] = [];
  walk(forecast.preset_root, (item) => {
    formulas.push(String(item.text_expression ?? ""));
  });
  assert.ok(formulas.some((source) => source.includes("wf(max, 0)")));
  assert.ok(formulas.some((source) => source.includes("wf(cond, 4)")));
});

test("advanced tools cover music, forecast, system, and motion recipes", () => {
  const ids = builtinTools().map((item) => item.id);
  for (const id of ["music-card", "forecast-day", "system-notify", "system-memory", "control-theme", "motion-drift", "time-face"]) {
    assert.ok(ids.includes(id), id);
  }
  const labels = formulaSnippets().map((item) => item.label);
  assert.ok(labels.includes("high"));
  assert.ok(labels.includes("wifi"));
  assert.ok(labels.includes("city"));
});
