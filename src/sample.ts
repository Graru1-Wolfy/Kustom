import type { KModule, Preset } from "./types";

function shape(
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  extras: Partial<KModule> = {},
): KModule {
  return {
    internal_type: "ShapeModule",
    internal_title: title,
    shape_type: "RECT",
    shape_width: w,
    shape_height: h,
    paint_color: color,
    position_anchor: "TOPLEFT",
    position_padding_left: x,
    position_padding_top: y,
    ...extras,
  };
}

function text(
  title: string,
  expression: string,
  x: number,
  y: number,
  size: number,
  color: string | { global: string },
): KModule {
  const mod: KModule = {
    internal_type: "TextModule",
    internal_title: title,
    text_expression: expression,
    text_size: size,
    position_anchor: "TOPLEFT",
    position_padding_left: x,
    position_padding_top: y,
  };
  if (typeof color === "string") mod.paint_color = color;
  else {
    mod.internal_globals = { paint_color: color.global };
    mod.internal_toggles = { paint_color: 100 };
  }
  return mod;
}

export function blankPreset(): Preset {
  return {
    preset_info: {
      version: 11,
      title: "Untitled",
      description: "",
      author: "",
      width: 1080,
      height: 1920,
      features: "",
      release: 1,
      locked: false,
      pflags: 0,
    },
    preset_root: {
      internal_type: "RootLayerModule",
      globals_list: {
        accent: { index: 1, type: "COLOR", title: "Accent", value: "#FFB6F27C" },
      },
      viewgroup_items: [
        {
          internal_type: "ShapeModule",
          internal_title: "Background",
          shape_type: "RECT",
          position_anchor: "TOPLEFT",
          paint_color: "#FF121610",
          internal_formulas: { shape_width: "$si(rwidth)$", shape_height: "$si(rheight)$" },
          internal_toggles: { shape_width: 10, shape_height: 10 },
        },
      ],
    },
  };
}

export function harborPreset(): Preset {
  const card: KModule = {
    internal_type: "OverlapLayerModule",
    internal_title: "Card",
    position_anchor: "TOPLEFT",
    position_padding_left: 64,
    position_padding_top: 1460,
    viewgroup_items: [
      shape("Card base", 0, 0, 952, 380, "#F01C2419", { shape_corners: 40 }),
      text("Battery label", "BATTERY", 48, 40, 22, { global: "muted" }),
      shape("Battery track", 48, 92, 620, 28, "#FF2C352A", { shape_corners: 14 }),
      {
        internal_type: "ShapeModule",
        internal_title: "Battery fill",
        shape_type: "RECT",
        shape_height: 28,
        shape_corners: 14,
        position_anchor: "TOPLEFT",
        position_padding_left: 48,
        position_padding_top: 92,
        internal_formulas: { shape_width: "$mu(max, 28, bi(level)*6.2)$" },
        internal_toggles: { shape_width: 10 },
        internal_globals: { paint_color: "accent" },
      },
      text("Battery percent", "$bi(level)$%", 700, 78, 42, { global: "ink" }),
      text("Temperature", "$wi(temp)$°", 48, 180, 72, { global: "ink" }),
      text("Condition", "$wi(cond)$", 210, 214, 32, { global: "muted" }),
      text("Charge state", '$if(bi(charging) & bi(fast), "Fast charge", bi(charging), "Charging", "On battery")$', 48, 290, 28, { global: "accent" }),
    ],
  };
  card.viewgroup_items![3]!.internal_toggles = { shape_width: 10, paint_color: 100 };

  return {
    preset_info: {
      version: 11,
      title: "Harbor",
      description: "Sample live wallpaper",
      author: "Kustom Editor",
      width: 1080,
      height: 1920,
      features: "WEATHER",
      release: 1,
      locked: false,
      pflags: 0,
    },
    preset_root: {
      internal_type: "RootLayerModule",
      globals_list: {
        accent: { index: 1, type: "COLOR", title: "Accent", value: "#FFB6F27C" },
        ink: { index: 2, type: "COLOR", title: "Ink", value: "#FFF3F6EC" },
        muted: { index: 3, type: "COLOR", title: "Muted", value: "#FFB7C3B0" },
        name: { index: 4, type: "TEXT", title: "Name", description: "Line above the clock", value: "Harbor" },
      },
      viewgroup_items: [
        {
          internal_type: "ShapeModule",
          internal_title: "Background",
          shape_type: "RECT",
          position_anchor: "TOPLEFT",
          paint_color: "#FF10160F",
          internal_formulas: { shape_width: "$si(rwidth)$", shape_height: "$si(rheight)$" },
          internal_toggles: { shape_width: 10, shape_height: 10 },
        },
        shape("Glow", 620, -160, 640, 640, "#335C8F55", { shape_type: "CIRCLE" }),
        text(
          "Greeting",
          '$if(df(H)<12, "GOOD MORNING", df(H)<18, "GOOD AFTERNOON", "GOOD EVENING")$',
          84,
          280,
          28,
          { global: "accent" },
        ),
        text("Name", "$gv(name)$", 84, 324, 40, { global: "muted" }),
        text("Clock", "$df(HH:mm)$", 76, 400, 168, { global: "ink" }),
        shape("Accent rule", 88, 600, 132, 8, "#FFB6F27C", { shape_corners: 4 }),
        text("Weekday", "$df(EEEE)$", 84, 630, 40, { global: "ink" }),
        text("Date", "$df(MMMM d)$", 84, 684, 32, { global: "muted" }),
        card,
      ],
    },
  };
}
