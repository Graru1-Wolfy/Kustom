import { harborPreset } from "./sample";
import type { KModule, Preset } from "./types";

export type PresetEntry = {
  id: string;
  title: string;
  blurb: string;
  filename: string;
  build: () => Preset;
};

export function presetCatalog(): PresetEntry[] {
  return [
    {
      id: "harbor",
      title: "Harbor",
      blurb: "Clock, greeting, and a weather card",
      filename: "Harbor.klwp",
      build: harborPreset,
    },
    {
      id: "glass",
      title: "Glass",
      blurb: "Music player with play, next, and a spinning ring",
      filename: "Glass.klwp",
      build: glassPreset,
    },
    {
      id: "forecast",
      title: "Forecast",
      blurb: "Five-day weather from wf()",
      filename: "Forecast.klwp",
      build: forecastPreset,
    },
    {
      id: "lumen",
      title: "Lumen",
      blurb: "Theme list, toggle, and a fade that follows the switch",
      filename: "Lumen.klwp",
      build: lumenPreset,
    },
    {
      id: "atlas",
      title: "Atlas",
      blurb: "Battery, day, memory, storage, and notifications",
      filename: "Atlas.klwp",
      build: atlasPreset,
    },
  ];
}

const INK = "#FFF4F7EF";
const MUTED = "#FFB7C3B0";
const LIME = "#FFB6F27C";

function glassPreset(): Preset {
  const ink = "#FFF4F8FF";
  const muted = "#FF9BB0C9";
  const accent = "#FF8FD0FF";
  const disc = overlap("Disc", [
    shape("Plate", "CIRCLE", 320, 320, "#FF1C2A48"),
    stroke("Groove", 320, "#66486880", 26),
    anim(ring("Ring", '$if(mi(state)="playing", 78, 16)$', accent, 320, 26), {
      type: "LOOP",
      action: "ROTATE",
      duration: 8,
      angle: 360,
      ease: "LINEAR",
    }),
    shape("Hub", "CIRCLE", 92, 92, "#FF10182C", 0, { position_anchor: "CENTER" }),
    event(
      text("Play", '$if(mi(state)="playing", "STOP", "PLAY")$', 24, ink, { position_anchor: "CENTER" }),
      { type: "SINGLE_TAP", action: "MUSIC", music_action: "TOGGLE" },
    ),
  ]);
  const controls = stack(
    "Controls",
    "HORIZONTAL",
    20,
    [
      pill("Prev", "PREV", 180, "#FF243044", ink, { type: "SINGLE_TAP", action: "MUSIC", music_action: "PREV" }),
      pill("Play", '$if(mi(state)="playing", "STOP", "PLAY")$', 200, accent, "#FF071018", {
        type: "SINGLE_TAP",
        action: "MUSIC",
        music_action: "TOGGLE",
      }),
      pill("Next", "NEXT", 180, "#FF243044", ink, { type: "SINGLE_TAP", action: "MUSIC", music_action: "NEXT" }),
    ],
  );
  return screen(
    "Glass",
    "Music player",
    "MUSIC",
    {
      accent: { index: 1, type: "COLOR", title: "Accent", value: accent },
      ink: { index: 2, type: "COLOR", title: "Ink", value: ink },
      muted: { index: 3, type: "COLOR", title: "Muted", value: muted },
    },
    [
      background("#FF0C1220"),
      at(shape("Glow", "CIRCLE", 680, 680, "#338FD0FF"), 640, -220),
      at(text("Kicker", "NOW PLAYING", 24, accent), 84, 200),
      at(text("Title", "$mi(title)$", 84, ink), 80, 260),
      at(text("Artist", "$mi(artist)$", 36, muted), 84, 380),
      at(text("State", "$tc(up, mi(state))$", 24, muted), 84, 450),
      at(disc, 380, 530),
      at(controls, 240, 940),
      at(text("Hint", "Turn on Interact, then tap play or next.", 24, muted), 84, 1100),
    ],
  );
}

function forecastPreset(): Preset {
  const accent = "#FFFFC46B";
  const days = stack(
    "Days",
    "HORIZONTAL",
    28,
    [day("Today", 0, accent), day("+1", 1, accent), day("+2", 2, accent), day("+3", 3, accent), day("+4", 4, accent)],
  );
  return screen(
    "Forecast",
    "Five-day weather",
    "WEATHER",
    {
      accent: { index: 1, type: "COLOR", title: "Accent", value: accent },
      ink: { index: 2, type: "COLOR", title: "Ink", value: "#FFFFF6EA" },
      muted: { index: 3, type: "COLOR", title: "Muted", value: "#FFCDBBA6" },
    },
    [
      background("#FF14110E"),
      at(shape("Glow", "CIRCLE", 520, 520, "#33FFC46B"), 680, -80),
      at(text("Place", "$li(loc)$", 28, "#FFCDBBA6"), 84, 180),
      at(
        text(
          "Greeting",
          '$if(df(H)<5, "GOOD NIGHT", df(H)<12, "GOOD MORNING", df(H)<18, "GOOD AFTERNOON", "GOOD EVENING")$',
          26,
          accent,
        ),
        84,
        240,
      ),
      at(text("Temp", "$wi(temp)$°", 150, "#FFFFF6EA"), 76, 320),
      at(text("Sky", "$tc(cap, wi(cond))$", 40, "#FFFFF6EA"), 84, 520),
      at(text("Meta", '$wi(hum)$%   ·   $wi(wspeed)$ $li(spdu)$', 26, "#FFCDBBA6"), 84, 590),
      at(days, 72, 780),
    ],
  );
}

function lumenPreset(): Preset {
  const word = formulas(text("Theme", "$tc(up, gv(theme))$", 108, INK), {
    paint_color: '$if(gv(theme)="rose", "#FFFF8FA3", gv(theme)="ice", "#FF9FD7FF", "#FFB6F27C")$',
  });
  const choices = stack("Themes", "HORIZONTAL", 48, [
    swatch("lime", "Lime", LIME),
    swatch("rose", "Rose", "#FFFF8FA3"),
    swatch("ice", "Ice", "#FF9FD7FF"),
  ]);
  const glow = anim(
    formulas(shape("Glow", "CIRCLE", 560, 560, LIME), {
      paint_color: '$if(gv(theme)="rose", "#55FF8FA3", gv(theme)="ice", "#559FD7FF", "#55B6F27C")$',
    }),
    { type: "LOOP", action: "SCALE", duration: 3.2, amount: 86, ease: "EASE" },
  );
  const reveal = anim(text("Reveal", "The room is on", 36, INK), {
    type: "FORMULA",
    action: "FADE",
    duration: 0.4,
    formula: "$if(gv(on),1,0)$",
    ease: "EASE",
  });
  return screen(
    "Lumen",
    "Theme and switch",
    "",
    {
      theme: { index: 1, type: "LIST", title: "Theme", value: "lime", entries: "lime##Lime,rose##Rose,ice##Ice" },
      on: { index: 2, type: "SWITCH", title: "On", value: 1 },
    },
    [
      formulas(background("#FF10160F"), {
        paint_color: '$if(gv(theme)="rose", "#FF1A1014", gv(theme)="ice", "#FF10141C", "#FF10160F")$',
      }),
      at(glow, 620, -140),
      at(text("Kicker", "THEME", 24, MUTED), 84, 220),
      at(word, 76, 280),
      at(text("Clock", "$df(HH:mm)$", 64, INK), 80, 460),
      at(choices, 84, 640),
      at(toggleBlock(), 84, 900),
      at(reveal, 84, 1040),
    ],
  );
}

function atlasPreset(): Preset {
  const meters = stack("Meters", "VERTICAL", 28, [
    meter("Memory", "$mu(max, 16, rm(mused)/rm(mtot)*640)$", "$rm(mused)$ / $rm(mtot)$ GB"),
    meter("Storage", "$mu(max, 16, rm(fsused)/rm(fstot)*640)$", "$rm(fsused)$ / $rm(fstot)$ GB"),
    meter("Brightness", "$mu(max, 16, si(system, screen_brightness)/255*640)$", "$si(system, screen_brightness)$"),
  ]);
  return screen(
    "Atlas",
    "Phone status",
    "",
    {
      accent: { index: 1, type: "COLOR", title: "Accent", value: LIME },
      ink: { index: 2, type: "COLOR", title: "Ink", value: INK },
      muted: { index: 3, type: "COLOR", title: "Muted", value: MUTED },
    },
    [
      background("#FF101410"),
      at(text("Kicker", "ATLAS", 24, LIME), 84, 150),
      at(text("Model", "$si(model)$", 56, INK), 80, 200),
      at(text("System", "Android $si(aver)$  ·  $si(lnchname)$", 26, MUTED), 84, 290),
      at(text("Place", "$li(loc)$  ·  $li(ccode)$", 32, INK), 84, 360),
      at(text("Wifi", "$nc(ssid)$  ·  $nc(wifi)$", 26, MUTED), 84, 420),
      at(labeledRing("Battery", "$bi(level)$", "$bi(level)$%", false), 100, 520),
      at(labeledRing("Day", "HOURS", "$df(h)$h", true), 460, 520),
      at(labeledRing("Seconds", "SECS", "$df(ss)$", true), 780, 160),
      at(meters, 100, 860),
      at(
        overlap("Notices", [
          formulas(shape("Badge", "CIRCLE", 84, 84, "#FFFF8A7A"), { config_visible: "$ni(count)$" }),
          formulas(text("Count", "$ni(count)$", 32, "#FF1A100E", { position_anchor: "CENTER" }), { config_visible: "$ni(count)$" }),
          text("Label", "$ni(count)$ notices", 28, MUTED, { position_padding_left: 108, position_padding_top: 24 }),
        ]),
        100,
        1240,
      ),
    ],
  );
}

function screen(
  title: string,
  description: string,
  features: string,
  globals: Preset["preset_root"]["globals_list"],
  items: KModule[],
): Preset {
  return {
    preset_info: {
      version: 11,
      title,
      description,
      author: "Kustom Editor",
      width: 1080,
      height: 1920,
      features,
      release: 1,
      locked: false,
      pflags: 0,
    },
    preset_root: {
      internal_type: "RootLayerModule",
      globals_list: globals,
      viewgroup_items: items,
    },
  };
}

function day(label: string, index: number, accent: string): KModule {
  return overlap(label, [
    shape("Slot", "RECT", 168, 4, "#00000000"),
    stack(label, "VERTICAL", 10, [
      text("Day", label, 22, "#FFCDBBA6"),
      text("Sky", `$tc(cap, wf(cond, ${index}))$`, 24, "#FFFFF6EA"),
      text("High", `$wf(max, ${index})$°`, 34, accent),
      text("Low", `$wf(min, ${index})$°`, 22, "#FFCDBBA6"),
    ]),
  ]);
}

function swatch(value: string, label: string, color: string): KModule {
  return stack(label, "VERTICAL", 12, [
    event(shape(label, "CIRCLE", 84, 84, color), {
      type: "SINGLE_TAP",
      action: "SET_GLOBAL",
      switch: "theme",
      switch_list: value,
    }),
    text("Name", label, 24, INK),
  ]);
}

function toggleBlock(): KModule {
  const pill = formulas(shape("Pill", "RECT", 280, 84, "#FF2C352A", 42), {
    paint_color: '$if(gv(on), "#FFB6F27C", "#FF2C352A")$',
  });
  const label = formulas(text("Label", '$if(gv(on), "ON", "OFF")$', 28, "#FF172000", { position_anchor: "CENTER" }), {
    paint_color: '$if(gv(on), "#FF172000", "#FFF4F7EF")$',
  });
  const tap = { type: "SINGLE_TAP", action: "SWITCH_GLOBAL", switch: "on" };
  return overlap("Toggle", [event(pill, tap), event(label, tap)]);
}

function meter(title: string, widthFormula: string, caption: string): KModule {
  const fill = formulas(shape("Fill", "RECT", 80, 16, LIME, 8), { shape_width: widthFormula });
  return stack(title, "VERTICAL", 8, [
    text("Caption", `${title}   ${caption}`, 24, MUTED),
    overlap("Bar", [shape("Track", "RECT", 640, 16, "#FF2C352A", 8), fill]),
  ]);
}

function labeledRing(title: string, progress: string, caption: string, literal: boolean): KModule {
  return overlap(title, [
    stroke("Track", 220, "#FF2A3328", 18),
    ring(title, progress, LIME, 220, 18, literal),
    text("Value", caption, 32, INK, { position_anchor: "CENTER" }),
  ]);
}

function stroke(title: string, size: number, color: string, width: number): KModule {
  return shape(title, "CIRCLE", size, size, color, 0, { paint_style: "STROKE", paint_stroke: width });
}

function ring(title: string, progress: string, color: string, size: number, thickness: number, literal = false): KModule {
  const mod: KModule = {
    internal_type: "ProgressModule",
    internal_title: title,
    style_style: "CIRCLE",
    style_size: size,
    style_height: thickness,
    paint_color: color,
    position_anchor: "TOPLEFT",
  };
  if (literal) mod.progress_progress = progress;
  else formulas(mod, { progress_progress: progress });
  return mod;
}

function pill(
  title: string,
  label: string,
  width: number,
  fill: string,
  ink: string,
  tap: Record<string, unknown>,
): KModule {
  return overlap(title, [
    event(shape(title, "RECT", width, 84, fill, 42), tap),
    event(text("Label", label, 26, ink, { position_anchor: "CENTER" }), tap),
  ]);
}

function background(color: string): KModule {
  return formulas(shape("Background", "RECT", 1080, 1920, color), {
    shape_width: "$si(rwidth)$",
    shape_height: "$si(rheight)$",
  });
}

function shape(title: string, kind: string, w: number, h: number, color: string, corners = 0, extras: Partial<KModule> = {}): KModule {
  return placed({
    internal_type: "ShapeModule",
    internal_title: title,
    shape_type: kind,
    shape_width: w,
    shape_height: h,
    shape_corners: corners,
    paint_color: color,
    ...extras,
  });
}

function text(title: string, expression: string, size: number, color: string, extras: Partial<KModule> = {}): KModule {
  return placed({
    internal_type: "TextModule",
    internal_title: title,
    text_expression: expression,
    text_size: size,
    paint_color: color,
    ...extras,
  });
}

function placed(mod: KModule): KModule {
  const anchor = String(mod.position_anchor ?? "TOPLEFT").toUpperCase();
  mod.position_anchor = anchor;
  if (anchor === "CENTER") {
    delete mod.position_padding_left;
    delete mod.position_padding_top;
    return mod;
  }
  if (mod.position_padding_left == null) mod.position_padding_left = 0;
  if (mod.position_padding_top == null) mod.position_padding_top = 0;
  return mod;
}

function overlap(title: string, items: KModule[]): KModule {
  return {
    internal_type: "OverlapLayerModule",
    internal_title: title,
    position_anchor: "TOPLEFT",
    viewgroup_items: items,
  };
}

function stack(title: string, direction: string, margin: number, items: KModule[]): KModule {
  return {
    internal_type: "StackLayerModule",
    internal_title: title,
    position_anchor: "TOPLEFT",
    config_stacking: direction,
    config_margin: margin,
    viewgroup_items: items,
  };
}

function at(mod: KModule, x: number, y: number): KModule {
  mod.position_anchor = "TOPLEFT";
  mod.position_padding_left = x;
  mod.position_padding_top = y;
  return mod;
}

function formulas(mod: KModule, map: Record<string, string>): KModule {
  const formulas = (mod.internal_formulas ??= {});
  const toggles = (mod.internal_toggles ??= {});
  for (const [key, source] of Object.entries(map)) {
    formulas[key] = source.startsWith("$") ? source : `$${source}$`;
    toggles[key] = 10;
  }
  return mod;
}

function event(mod: KModule, tap: Record<string, unknown>): KModule {
  mod.internal_events = [tap];
  return mod;
}

function anim(mod: KModule, animation: Record<string, unknown>): KModule {
  mod.internal_animations = [animation];
  return mod;
}
