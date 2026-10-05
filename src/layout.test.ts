import assert from "node:assert/strict";
import test from "node:test";
import { defaultDevice } from "./device";
import { anchoredOrigin, layoutPreset, positionWrites } from "./layout";
import type { Preset } from "./types";

const measure = (text: string, size: number) => {
  const lines = text.split("\n");
  const width = Math.max(1, ...lines.map((line) => line.length * size * 0.5));
  return { w: width, h: lines.length * size * 1.2 };
};

test("anchors from the edges and from the center", () => {
  assert.deepEqual(anchoredOrigin("TOPLEFT", 500, 800, 100, 40, 12, 20, 0, 0, 0, 0), { x: 12, y: 20 });
  assert.deepEqual(anchoredOrigin("CENTER", 500, 800, 100, 40, 0, 0, 0, 0, 8, -4), { x: 208, y: 376 });
  const back = positionWrites("TOPLEFT", 500, 800, 100, 40, 50, 70, 0, 0, 0, 0, 0, 0);
  assert.deepEqual(back, [
    { key: "position_padding_left", value: 50 },
    { key: "position_padding_top", value: 70 },
  ]);
});

test("bottom anchor uses whichever horizontal padding is set", () => {
  assert.deepEqual(anchoredOrigin("BOTTOM", 722, 571, 100, 40, 0, 0, 400, 24, 0, 0, { r: true, b: true }), {
    x: 222,
    y: 507,
  });
});

test("lays out a stack over a full-screen shape", () => {
  const now = new Date(2026, 9, 5, 9, 30, 0);
  const preset: Preset = {
    preset_info: { width: 200, height: 400, title: "Tiny" },
    preset_root: {
      internal_type: "RootLayerModule",
      globals_list: { accent: { type: "COLOR", value: "#FF7CFFB2" } },
      viewgroup_items: [
        {
          internal_type: "ShapeModule",
          internal_title: "Background",
          shape_type: "RECT",
          internal_formulas: { shape_width: "$si(rwidth)$", shape_height: "$si(rheight)$" },
          internal_toggles: { shape_width: 10, shape_height: 10 },
          paint_color: "#FF101410",
          position_anchor: "TOPLEFT",
        },
        {
          internal_type: "TextModule",
          internal_title: "Clock",
          text_expression: "$df(HH:mm)$",
          text_size: 40,
          position_anchor: "TOPLEFT",
          position_padding_left: 16,
          position_padding_top: 24,
          internal_globals: { paint_color: "accent" },
          internal_toggles: { paint_color: 100 },
        },
      ],
    },
  };
  const nodes = layoutPreset(preset, { ...defaultDevice(now), now }, { measure });
  const background = nodes.find((node) => node.title === "Background");
  const clock = nodes.find((node) => node.title === "Clock");
  assert.equal(background?.w, 200);
  assert.equal(background?.h, 400);
  assert.equal(clock?.text, "09:30");
  assert.equal(clock?.x, 16);
  assert.equal(clock?.y, 24);
  assert.match(clock?.css.color ?? "", /124, 255, 178/);
});
