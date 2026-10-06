import type { GlobalDef, KModule } from "../types";

export type Tool = {
  id: string;
  group: string;
  name: string;
  blurb: string;
  module: KModule;
  globals?: Record<string, GlobalDef>;
};

const STORAGE_KEY = "kustom.toolsets.v1";
let memory: Tool[] = [];

export function builtinTools(): Tool[] {
  return [
    tool("draw-text", "Draw", "Text", "A plain text layer", text("Text", "Text", 56, "#FFF4F7EF")),
    tool("draw-rect", "Draw", "Rectangle", "Rounded rectangle", shape("Rectangle", "RECT", 320, 180, "#FFB6F27C", 24)),
    tool("draw-circle", "Draw", "Circle", "Filled circle", shape("Circle", "CIRCLE", 220, 220, "#FFB6F27C", 0)),
    tool("draw-progress", "Draw", "Progress", "Ring bound to battery level", {
      internal_type: "ProgressModule",
      internal_title: "Progress",
      style_style: "CIRCLE",
      style_size: 180,
      style_height: 16,
      paint_color: "#FFB6F27C",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
      internal_formulas: { progress_progress: "$bi(level)$" },
      internal_toggles: { progress_progress: 10 },
    }),
    tool("draw-group", "Draw", "Overlap", "Layers stacked in one box", {
      internal_type: "OverlapLayerModule",
      internal_title: "Overlap",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
      viewgroup_items: [shape("Base", "RECT", 420, 260, "#FF243026", 28, 0)],
    }),
    tool("draw-stack", "Draw", "Stack", "Items in a column", {
      internal_type: "StackLayerModule",
      internal_title: "Stack",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
      config_stacking: "VERTICAL",
      config_margin: 8,
      viewgroup_items: [text("Line", "First", 36, "#FFF4F7EF"), text("Line", "Second", 36, "#FFB7C3B0")],
    }),
    tool("time-clock", "Time", "Clock", "Hour and minute from df()", text("Clock", "$df(HH:mm)$", 120, "#FFF4F7EF")),
    tool("time-date", "Time", "Date", "Weekday and month", {
      internal_type: "StackLayerModule",
      internal_title: "Date",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
      config_stacking: "VERTICAL",
      config_margin: 4,
      viewgroup_items: [
        text("Weekday", "$df(EEEE)$", 36, "#FFF4F7EF"),
        text("Month", "$df(MMMM d)$", 28, "#FFB7C3B0"),
      ],
    }),
    tool(
      "time-greeting",
      "Time",
      "Greeting",
      "Morning, afternoon, or evening",
      text(
        "Greeting",
        '$if(df(H)<12, "GOOD MORNING", df(H)<18, "GOOD AFTERNOON", "GOOD EVENING")$',
        28,
        "#FFB6F27C",
      ),
    ),
    tool("status-battery", "Status", "Battery", "Track, fill, and percent", battery()),
    tool("status-weather", "Status", "Weather", "Temperature and sky", text("Weather", "$wi(temp)$°  $wi(cond)$", 32, "#FFF4F7EF")),
    tool("control-toggle", "Controls", "Toggle", "Tap switches a global and the label", toggle(), {
      on: { index: 1, type: "SWITCH", title: "On", value: 1 },
    }),
    tool("motion-pulse", "Motion", "Pulse", "Scale loop, always visible", {
      ...shape("Pulse", "CIRCLE", 180, 180, "#FFB6F27C", 0),
      internal_animations: [{ type: "LOOP", action: "SCALE", duration: 2.2, amount: 82, ease: "EASE" }],
    }),
    tool("motion-spin", "Motion", "Spin", "Full turn on a loop", {
      ...shape("Spin", "RECT", 140, 28, "#FFB6F27C", 8),
      internal_animations: [{ type: "LOOP", action: "ROTATE", duration: 6, angle: 360, ease: "LINEAR" }],
    }),
    tool(
      "motion-reveal",
      "Motion",
      "Reveal",
      "Fades in while the On switch is set",
      text("Reveal", "Visible", 42, "#FFF4F7EF", {
        internal_animations: [{ type: "FORMULA", action: "FADE", duration: 0.4, formula: "$if(gv(on),1,0)$", ease: "EASE" }],
      }),
      { on: { index: 1, type: "SWITCH", title: "On", value: 1 } },
    ),
    tool("motion-drift", "Motion", "Drift", "Slides as the scroll preview moves", {
      ...shape("Drift", "RECT", 220, 64, "#FFB6F27C", 18),
      internal_animations: [{ type: "SCROLL", action: "SCROLL", amount: 160, angle: 0, ease: "LINEAR" }],
    }),
    tool("motion-unlock", "Motion", "Unlock", "Fades in after the phone unlocks", {
      ...text("Unlock", "Unlocked", 42, "#FFF4F7EF"),
      internal_animations: [{ type: "UNLOCK", action: "FADE", duration: 0.7, ease: "EASEOUT" }],
    }),
    tool("motion-bars", "Motion", "Bars", "Three pulses, like a tiny meter", bars()),
    tool("time-seconds", "Time", "Seconds", "Ring that tracks the current second", {
      internal_type: "ProgressModule",
      internal_title: "Seconds",
      style_style: "CIRCLE",
      style_size: 180,
      style_height: 14,
      paint_color: "#FFB6F27C",
      progress_progress: "SECS",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
    }),
    tool("time-face", "Time", "Clock face", "Hour ring with the digital time inside", clockFace()),
    tool("music-card", "Music", "Player", "Title, artist, play, and next", musicCard()),
    tool("forecast-day", "Forecast", "Tomorrow", "High, low, and sky for the next day", forecastDay()),
    tool("system-notify", "System", "Notices", "Count from ni(), hidden at zero", noticeBadge(), {}),
    tool("system-wifi", "System", "Wi-Fi", "Network name and connection", text("Wi-Fi", "$nc(ssid)$  ·  $nc(wifi)$", 32, "#FFF4F7EF")),
    tool("system-place", "System", "Place", "City from li()", text("Place", "$li(loc)$", 40, "#FFF4F7EF")),
    tool("system-memory", "System", "Memory", "Used memory as a bar", memoryBar()),
    tool(
      "control-theme",
      "Controls",
      "Theme",
      "Three taps write a list global",
      themePicker(),
      { theme: { index: 1, type: "LIST", title: "Theme", value: "lime", entries: "lime##Lime,rose##Rose,ice##Ice" } },
    ),
  ];
}

export function loadCustomTools(): Tool[] {
  const stored = readStorage();
  return stored ?? memory.map((item) => structuredClone(item));
}

export function saveCustomTool(tool: Tool) {
  const next = loadCustomTools().filter((item) => item.id !== tool.id);
  next.push(tool);
  writeStorage(next);
}

export function deleteCustomTool(id: string) {
  writeStorage(loadCustomTools().filter((item) => item.id !== id));
}

export function formulaSnippets(): { group: string; label: string; insert: string }[] {
  return [
    { group: "Date", label: "df(HH:mm)", insert: "$df(HH:mm)$" },
    { group: "Date", label: "df(EEEE)", insert: "$df(EEEE)$" },
    { group: "Date", label: "df(MMMM d)", insert: "$df(MMMM d)$" },
    { group: "Date", label: "hour", insert: "$df(H)$" },
    { group: "Logic", label: "if", insert: '$if(df(H)<12, "AM", "PM")$' },
    { group: "Math", label: "min", insert: "$mu(min, 10, bi(level))$" },
    { group: "Math", label: "max", insert: "$mu(max, 28, bi(level)*6)$" },
    { group: "Text", label: "upper", insert: "$tc(up, wi(cond))$" },
    { group: "Text", label: "len", insert: "$len(mi(title))$" },
    { group: "Globals", label: "gv", insert: "$gv(name)$" },
    { group: "Battery", label: "level", insert: "$bi(level)$" },
    { group: "Battery", label: "charging", insert: "$bi(charging)$" },
    { group: "Weather", label: "temp", insert: "$wi(temp)$" },
    { group: "Weather", label: "sky", insert: "$wi(cond)$" },
    { group: "Music", label: "title", insert: "$mi(title)$" },
    { group: "Music", label: "artist", insert: "$mi(artist)$" },
    { group: "Music", label: "state", insert: "$mi(state)$" },
    { group: "Forecast", label: "high", insert: "$wf(max, 1)$" },
    { group: "Forecast", label: "sky", insert: "$wf(cond, 1)$" },
    { group: "Network", label: "wifi", insert: "$nc(ssid)$" },
    { group: "Place", label: "city", insert: "$li(loc)$" },
    { group: "Device", label: "model", insert: "$si(model)$" },
    { group: "Device", label: "day", insert: "$ai(isday)$" },
    { group: "Memory", label: "used", insert: "$rm(mused)$" },
    { group: "Color", label: "cm", insert: "$cm(255, 182, 242, 124)$" },
    { group: "System", label: "width", insert: "$si(rwidth)$" },
    { group: "System", label: "index", insert: "$si(mindex)$" },
    { group: "Flow", label: "fl", insert: '$fl(1, 4, "i+1", "#")$' },
    { group: "Notify", label: "ni", insert: "$ni(count)$" },
  ];
}

function tool(id: string, group: string, name: string, blurb: string, module: KModule, globals?: Record<string, GlobalDef>): Tool {
  return { id, group, name, blurb, module, globals };
}

function text(title: string, expression: string, size: number, color: string, extras: Partial<KModule> = {}, pad = 80): KModule {
  return {
    internal_type: "TextModule",
    internal_title: title,
    text_expression: expression,
    text_size: size,
    paint_color: color,
    position_anchor: "TOPLEFT",
    position_padding_left: pad,
    position_padding_top: pad,
    ...extras,
  };
}

function shape(title: string, kind: string, w: number, h: number, color: string, corners: number, pad = 80): KModule {
  return {
    internal_type: "ShapeModule",
    internal_title: title,
    shape_type: kind,
    shape_width: w,
    shape_height: h,
    shape_corners: corners,
    paint_color: color,
    position_anchor: "TOPLEFT",
    position_padding_left: pad,
    position_padding_top: pad,
  };
}

function battery(): KModule {
  return {
    internal_type: "OverlapLayerModule",
    internal_title: "Battery",
    position_anchor: "TOPLEFT",
    position_padding_left: 72,
    position_padding_top: 1500,
    viewgroup_items: [
      shape("Track", "RECT", 640, 28, "#FF2C352A", 14, 0),
      {
        ...shape("Fill", "RECT", 200, 28, "#FFB6F27C", 14, 0),
        internal_formulas: { shape_width: "$mu(max, 28, bi(level)*6.2)$" },
        internal_toggles: { shape_width: 10 },
      },
      {
        ...text("Percent", "$bi(level)$%", 36, "#FFF4F7EF", {}, 0),
        position_padding_left: 660,
        position_padding_top: -6,
      },
    ],
  };
}

function toggle(): KModule {
  const pill = shape("Pill", "RECT", 280, 84, "#FF2C352A", 42, 0);
  pill.internal_formulas = { paint_color: '$if(gv(on), "#FFB6F27C", "#FF2C352A")$' };
  pill.internal_toggles = { paint_color: 10 };
  pill.internal_events = [{ type: "SINGLE_TAP", action: "SWITCH_GLOBAL", switch: "on" }];
  const label = text("Label", '$if(gv(on), "ON", "OFF")$', 28, "#FF172000", {}, 0);
  label.position_anchor = "CENTER";
  label.position_padding_left = 0;
  label.position_padding_top = 0;
  label.internal_formulas = { paint_color: '$if(gv(on), "#FF172000", "#FFF4F7EF")$' };
  label.internal_toggles = { paint_color: 10 };
  label.internal_events = [{ type: "SINGLE_TAP", action: "SWITCH_GLOBAL", switch: "on" }];
  return {
    internal_type: "OverlapLayerModule",
    internal_title: "Toggle",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
    viewgroup_items: [pill, label],
  };
}

function bars(): KModule {
  const bar = (title: string, height: number, duration: number) => ({
    ...shape(title, "RECT", 22, height, "#FFB6F27C", 8, 0),
    internal_animations: [{ type: "LOOP", action: "SCALE", duration, amount: 40, ease: "EASE" }],
  });
  return {
    internal_type: "StackLayerModule",
    internal_title: "Bars",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
    config_stacking: "HORIZONTAL",
    config_margin: 12,
    viewgroup_items: [bar("Low", 72, 1.1), bar("Mid", 120, 0.8), bar("High", 90, 1.4)],
  };
}

function clockFace(): KModule {
  return {
    internal_type: "OverlapLayerModule",
    internal_title: "Clock face",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
    viewgroup_items: [
      {
        internal_type: "ProgressModule",
        internal_title: "Hours",
        style_style: "CIRCLE",
        style_size: 280,
        style_height: 16,
        paint_color: "#FFB6F27C",
        progress_progress: "HOURS",
        position_anchor: "TOPLEFT",
      },
      text("Time", "$df(HH:mm)$", 48, "#FFF4F7EF", { position_anchor: "CENTER" }, 0),
    ],
  };
}

function musicCard(): KModule {
  const play = text("Play", '$if(mi(state)="playing", "PAUSE", "PLAY")$', 26, "#FF8FD0FF", {}, 0);
  play.position_padding_left = 36;
  play.position_padding_top = 180;
  play.internal_events = [{ type: "SINGLE_TAP", action: "MUSIC", music_action: "TOGGLE" }];
  const next = text("Next", "NEXT", 26, "#FF9BB0C9", {}, 0);
  next.position_padding_left = 180;
  next.position_padding_top = 180;
  next.internal_events = [{ type: "SINGLE_TAP", action: "MUSIC", music_action: "NEXT" }];
  const title = text("Title", "$mi(title)$", 48, "#FFF4F8FF", {}, 0);
  title.position_padding_left = 36;
  title.position_padding_top = 32;
  const artist = text("Artist", "$mi(artist)$", 26, "#FF9BB0C9", {}, 0);
  artist.position_padding_left = 36;
  artist.position_padding_top = 108;
  return {
    internal_type: "OverlapLayerModule",
    internal_title: "Player",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
    viewgroup_items: [shape("Plate", "RECT", 720, 260, "#FF182438", 28, 0), title, artist, play, next],
  };
}

function forecastDay(): KModule {
  return {
    internal_type: "StackLayerModule",
    internal_title: "Tomorrow",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
    config_stacking: "VERTICAL",
    config_margin: 6,
    viewgroup_items: [
      text("Day", "Tomorrow", 22, "#FFCDBBA6", {}, 0),
      text("Sky", "$tc(cap, wf(cond, 1))$", 32, "#FFFFF6EA", {}, 0),
      text("High", "$wf(max, 1)$°", 48, "#FFFFC46B", {}, 0),
      text("Low", "$wf(min, 1)$°", 28, "#FFCDBBA6", {}, 0),
    ],
  };
}

function noticeBadge(): KModule {
  const badge = shape("Badge", "CIRCLE", 84, 84, "#FFFF8A7A", 0, 0);
  const count = text("Count", "$ni(count)$", 32, "#FF1A100E", { position_anchor: "CENTER" }, 0);
  const group: KModule = {
    internal_type: "OverlapLayerModule",
    internal_title: "Notices",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
    viewgroup_items: [badge, count],
  };
  group.internal_formulas = { config_visible: "$ni(count)$" };
  group.internal_toggles = { config_visible: 10 };
  return group;
}

function memoryBar(): KModule {
  const fill = shape("Fill", "RECT", 80, 18, "#FFB6F27C", 9, 0);
  fill.internal_formulas = { shape_width: "$mu(max, 18, rm(mused)/rm(mtot)*420)$" };
  fill.internal_toggles = { shape_width: 10 };
  return {
    internal_type: "OverlapLayerModule",
    internal_title: "Memory",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
    viewgroup_items: [
      shape("Track", "RECT", 420, 18, "#FF2C352A", 9, 0),
      fill,
      text("Label", "$rm(mused)$ / $rm(mtot)$ GB", 24, "#FFF4F7EF", { position_padding_top: 32 }, 0),
    ],
  };
}

function themePicker(): KModule {
  const dot = (title: string, value: string, color: string, x: number) => {
    const item = shape(title, "CIRCLE", 72, 72, color, 0, 0);
    item.position_padding_left = x;
    item.internal_events = [{ type: "SINGLE_TAP", action: "SET_GLOBAL", switch: "theme", switch_list: value }];
    return item;
  };
  const label = text("Theme", "$tc(cap, gv(theme))$", 32, "#FFF4F7EF", {}, 0);
  label.position_padding_top = 96;
  return {
    internal_type: "OverlapLayerModule",
    internal_title: "Theme",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
    viewgroup_items: [dot("Lime", "lime", "#FFB6F27C", 0), dot("Rose", "rose", "#FFFF8FA3", 96), dot("Ice", "ice", "#FF9FD7FF", 192), label],
  };
}

function readStorage(): Tool[] | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Tool[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

function writeStorage(tools: Tool[]) {
  memory = tools.map((item) => structuredClone(item));
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
  } catch {
    /* the in-memory copy still works for this session */
  }
}
