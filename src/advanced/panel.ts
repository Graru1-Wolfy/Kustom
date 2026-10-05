import { rgbaCss, rgbHex, toHex8 } from "../color";
import { setFormula, setGlobalLink, setLiteral } from "../props";
import type { Device, GlobalDef, KModule, Preset } from "../types";
import { animationFrame, type AnimEnv } from "./animate";
import { applyEvent, describeEvent, type KEvent } from "./events";
import { builtinTools, deleteCustomTool, formulaSnippets, loadCustomTools, saveCustomTool, type Tool } from "./tools";

export type StudioHost = {
  preset: Preset;
  module: KModule | null;
  device: Device;
  scroll: number;
  setScroll: (value: number) => void;
  unlocked: boolean;
  setUnlocked: (value: boolean) => void;
  pushHistory: () => void;
  refresh: () => void;
  preview: () => void;
  status: (message: string) => void;
  insertTool: (tool: Tool) => void;
  evalSource: (source: string) => string;
  animEnv: () => AnimEnv;
  replaceModule: (next: KModule) => void;
  replacePreset: (next: Preset) => void;
  readProp: (key: string) => { mode: "value" | "formula" | "global"; raw: string; value: string };
};

const REACT = ["LOOP", "SCROLL", "BG", "UNLOCK", "FORMULA", "SWITCH"];
const ACTIONS = ["FADE", "FADE_INVERTED", "SCALE", "ROTATE", "SCROLL"];
const EASES = ["EASE", "LINEAR", "EASEIN", "EASEOUT"];
const GESTURES = ["SINGLE_TAP", "DOUBLE_TAP", "LONG_PRESS"];
const EVENT_ACTIONS = ["SWITCH_GLOBAL", "SET_GLOBAL", "MUSIC", "OPEN_URL", "LAUNCH_APP"];
const MUSIC = ["TOGGLE", "PLAY", "PAUSE", "NEXT", "PREV", "OPEN_APP"];

export function renderToolList(root: HTMLElement, host: StudioHost) {
  root.replaceChildren();
  const save = document.createElement("div");
  save.className = "tool-save";
  const name = input("");
  name.placeholder = "Name";
  const group = input("Mine");
  group.placeholder = "Toolset";
  const button = action("Save selection", () => {
    if (!host.module || host.module.internal_type === "RootLayerModule") {
      host.status("Select an item to save as a tool.");
      return;
    }
    const title = name.value.trim() || String(host.module.internal_title || "Tool");
    saveCustomTool({
      id: `custom-${Date.now()}`,
      group: group.value.trim() || "Mine",
      name: title,
      blurb: "Saved from the canvas",
      module: structuredClone(host.module),
    });
    name.value = "";
    host.refresh();
  });
  save.append(name, group, button);
  root.append(save);
  const groups = new Map<string, Tool[]>();
  for (const item of [...builtinTools(), ...loadCustomTools()]) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  for (const [title, items] of groups) {
    const block = document.createElement("section");
    block.className = "tool-group";
    const heading = document.createElement("h3");
    heading.textContent = title;
    block.append(heading);
    for (const item of items) block.append(toolButton(item, host));
    root.append(block);
  }
}

export function paintFormula(root: HTMLElement, host: StudioHost) {
  const mod = host.module;
  note(root, "Bind a property to a Kustom formula. The phone shows the result.");
  if (!mod || mod.internal_type === "RootLayerModule") {
    scratch(root, host);
    return;
  }
  const props = properties(mod);
  const key = select(props.map((item) => [item.key, item.label] as [string, string]), props[0]?.key ?? "paint_color");
  const body = document.createElement("div");
  root.append(field("Property", key), body);
  const paint = () => paintProp(body, host, mod, key.value);
  key.addEventListener("change", paint);
  paint();
  scratch(root, host);
}

export function paintForm(root: HTMLElement, host: StudioHost) {
  const list = host.preset.preset_root.globals_list ?? (host.preset.preset_root.globals_list = {});
  note(root, "This is the preset form. Values here are the inputs formulas read with gv().");
  root.append(formPreview(list, host));
  const add = document.createElement("div");
  add.className = "actions";
  for (const type of ["COLOR", "NUMBER", "TEXT", "SWITCH", "LIST"]) {
    add.append(
      action(type[0] + type.slice(1).toLowerCase(), () => {
        host.pushHistory();
        const key = freshKey(list);
        list[key] = {
          index: Object.keys(list).length + 1,
          type,
          title: type === "COLOR" ? "Color" : type === "LIST" ? "Choice" : type[0] + type.slice(1).toLowerCase(),
          value: type === "COLOR" ? "#FFFFFFFF" : type === "NUMBER" ? 50 : type === "SWITCH" ? 1 : type === "LIST" ? "a" : "Text",
          ...(type === "NUMBER" ? { min: 0, max: 100 } : {}),
          ...(type === "LIST" ? { entries: "a##Alpha,b##Beta" } : {}),
        };
        host.refresh();
      }),
    );
  }
  root.append(add);
  for (const [key, global] of ordered(list)) root.append(globalEditor(key, global, list, host));
}

export function paintAnimate(root: HTMLElement, host: StudioHost) {
  const mod = needItem(root, host);
  if (!mod) return;
  note(root, "Animations use KLWP's internal_animations list. Loop and formula motions play on the phone.");
  const scroll = range(host.scroll, 0, 1, 0.01);
  scroll.addEventListener("input", () => host.setScroll(Number(scroll.value)));
  const unlock = check("Unlocked", host.unlocked, (value) => host.setUnlocked(value));
  root.append(field("Scroll preview", scroll), unlock);
  const list = Array.isArray(mod.internal_animations) ? (mod.internal_animations as Record<string, unknown>[]) : [];
  root.append(
    action("Add animation", () => {
      host.pushHistory();
      if (!Array.isArray(mod.internal_animations)) mod.internal_animations = [];
      (mod.internal_animations as Record<string, unknown>[]).push({ type: "LOOP", action: "SCALE", duration: 2, amount: 80, ease: "EASE" });
      host.refresh();
    }),
  );
  list.forEach((anim, index) => root.append(animCard(anim, index, list, host)));
  const env = host.animEnv();
  const frame = animationFrame(list, env);
  note(root, `Now: opacity ${frame.opacity.toFixed(2)} · scale ${frame.scale.toFixed(2)} · rotate ${Math.round(frame.rotate)}°`);
}

export function paintColor(root: HTMLElement, host: StudioHost) {
  const mod = needItem(root, host);
  if (!mod) return;
  const globals = host.preset.preset_root.globals_list ?? {};
  const info = host.readProp("paint_color");
  note(root, "Colors are #AARRGGBB. A global link keeps every item on that swatch in step.");
  if (info.mode === "formula") {
    note(root, `Formula ${info.raw}\nShows ${info.value}`);
    root.append(
      action("Use this color", () => {
        host.pushHistory();
        setLiteral(mod, "paint_color", toHex8(info.value));
        host.refresh();
      }),
    );
    return;
  }
  const linked = info.mode === "global" ? info.raw : "";
  const current = toHex8(info.mode === "global" ? info.value : info.raw || info.value);
  const write = (hex: string) => {
    if (linked && globals[linked]) globals[linked]!.value = hex;
    else setLiteral(mod, "paint_color", hex);
    host.preview();
  };
  root.append(colorEditor(current, write, host));
  const names = Object.entries(globals).filter(([, global]) => String(global.type).toUpperCase() === "COLOR");
  if (names.length) {
    const picker = select(
      [["", "Custom"], ...names.map(([key, global]) => [key, String(global.title || key)] as [string, string])],
      linked,
    );
    picker.addEventListener("change", () => {
      host.pushHistory();
      if (!picker.value) setLiteral(mod, "paint_color", current);
      else setGlobalLink(mod, "paint_color", picker.value);
      host.refresh();
    });
    root.append(field("Global", picker));
    const swatches = document.createElement("div");
    swatches.className = "swatches";
    for (const [key, global] of names) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.title = String(global.title || key);
      dot.style.background = rgbaCss(global.value);
      dot.addEventListener("click", () => {
        host.pushHistory();
        setGlobalLink(mod, "paint_color", key);
        host.refresh();
      });
      swatches.append(dot);
    }
    root.append(swatches);
  }
  if (mod.internal_type === "ShapeModule" || mod.internal_type === "ProgressModule") gradient(root, mod, host);
  if (mod.internal_type === "TextModule") {
    root.append(
      action("Insert color tag", () => {
        host.pushHistory();
        const tag = `[c=${current}]`;
        mod.text_expression = `${tag}${String(mod.text_expression ?? "")}[/c]`;
        host.refresh();
      }),
    );
  }
}

export function paintEvents(root: HTMLElement, host: StudioHost) {
  const mod = needItem(root, host);
  if (!mod) return;
  note(root, "Turn on Interact, then tap the item on the phone. Switches, lists, and music update the preview.");
  const list = Array.isArray(mod.internal_events) ? (mod.internal_events as KEvent[]) : [];
  root.append(
    action("Add tap", () => {
      host.pushHistory();
      if (!Array.isArray(mod.internal_events)) mod.internal_events = [];
      (mod.internal_events as KEvent[]).push({ type: "SINGLE_TAP", action: "SWITCH_GLOBAL", switch: "on" });
      host.refresh();
    }),
  );
  list.forEach((event, index) => root.append(eventCard(event, index, list, host)));
}

export function paintSource(root: HTMLElement, host: StudioHost) {
  const mod = host.module;
  note(root, "Source is the module JSON KLWP stores. Input is what that module evaluates to right now.");
  const mode = select(
    [
      ["item", "Item source"],
      ["preset", "Preset source"],
    ],
    "item",
  );
  const area = document.createElement("textarea");
  area.className = "source";
  const inputBox = document.createElement("div");
  const fill = () => {
    if (mode.value === "preset") area.value = JSON.stringify(host.preset, null, 2);
    else area.value = JSON.stringify(mod ?? {}, null, 2);
    inputBox.replaceChildren();
    if (mod) inputBox.append(inputView(mod, host));
  };
  mode.addEventListener("change", fill);
  root.append(field("Edit", mode), area);
  root.append(
    action("Apply source", () => {
      try {
        const parsed = JSON.parse(area.value) as KModule & Preset;
        host.pushHistory();
        if (mode.value === "preset") host.replacePreset(parsed);
        else host.replaceModule(parsed);
      } catch {
        note(root, "That source is not valid JSON.");
      }
    }),
  );
  fill();
  const heading = document.createElement("h3");
  heading.textContent = "Input";
  root.append(heading, inputBox);
}

function paintProp(root: HTMLElement, host: StudioHost, mod: KModule, key: string) {
  root.replaceChildren();
  if (key === "text_expression") {
    const area = document.createElement("textarea");
    area.value = String(mod.text_expression ?? "");
    const shown = result(host, area.value);
    bind(area, host, () => {
      mod.text_expression = area.value;
    }, shown);
    root.append(field("Expression", area), shown, chips(area));
    return;
  }
  const info = host.readProp(key);
  const mode = select(
    [
      ["value", "Value"],
      ["formula", "Formula"],
      ["global", "Global"],
    ],
    info.mode,
  );
  const body = document.createElement("div");
  root.append(field("Mode", mode), body);
  const paint = () => {
    body.replaceChildren();
    if (mode.value === "formula") {
const area = document.createElement("textarea");
    area.value = info.mode === "formula" ? info.raw : `$${info.value || "0"}$`;
    const shown = result(host, area.value);
    bind(area, host, () => setFormula(mod, key, wrapFormula(area.value)), shown);
    body.append(field("Formula", area), shown, chips(area));
    } else if (mode.value === "global") {
      const names = Object.keys(host.preset.preset_root.globals_list ?? {});
      const picker = select(names.map((name) => [name, name] as [string, string]), info.mode === "global" ? info.raw : names[0] ?? "");
      picker.addEventListener("change", () => {
        host.pushHistory();
        setGlobalLink(mod, key, picker.value);
        host.refresh();
      });
      body.append(field("Global", picker), result(host, info.value));
    } else {
      const box = input(info.mode === "value" ? info.raw : info.value);
      const shown = result(host, box.value);
      bind(box, host, () => setLiteral(mod, key, coerce(box.value)), shown);
      body.append(field("Value", box), shown);
    }
  };
  mode.addEventListener("change", () => {
    host.pushHistory();
    if (mode.value === "formula") setFormula(mod, key, wrapFormula(info.mode === "formula" ? info.raw : quoteFormula(info.value || "0")));
    else if (mode.value === "global") {
      const names = Object.keys(host.preset.preset_root.globals_list ?? {});
      if (names[0]) setGlobalLink(mod, key, info.mode === "global" ? info.raw : names[0]);
    } else setLiteral(mod, key, coerce(info.mode === "value" ? info.raw : info.value));
    host.refresh();
  });
  paint();
}

function scratch(root: HTMLElement, host: StudioHost) {
  const area = document.createElement("textarea");
  area.placeholder = "$df(HH:mm)$";
  const out = document.createElement("div");
  out.className = "resolved";
  area.addEventListener("input", () => {
    out.textContent = host.evalSource(area.value);
  });
  root.append(field("Try a formula", area), out, chips(area));
}

function formPreview(list: Record<string, GlobalDef>, host: StudioHost): HTMLElement {
  const card = document.createElement("div");
  card.className = "form-preview";
  const title = document.createElement("strong");
  title.textContent = String(host.preset.preset_info?.title || "Preset");
  card.append(title);
  const entries = ordered(list);
  if (!entries.length) {
    note(card, "Add a field and it shows up here, the way it would in Kustom.");
    return card;
  }
  for (const [key, global] of entries) card.append(previewControl(key, global, host));
  return card;
}

function previewControl(key: string, global: GlobalDef, host: StudioHost): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "field";
  const caption = document.createElement("span");
  caption.textContent = String(global.title || key);
  wrap.append(caption);
  const type = String(global.type || "TEXT").toUpperCase();
  if (type === "COLOR") {
    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = rgbHex(global.value);
    picker.addEventListener("input", () => {
      global.value = "#FF" + picker.value.slice(1).toUpperCase();
      host.preview();
    });
    wrap.append(picker);
  } else if (type === "NUMBER" || type === "SWITCH") {
    const slider = range(Number(global.value ?? 0), Number(global.min ?? 0), Number(global.max ?? (type === "SWITCH" ? 1 : 100)), 1);
    slider.addEventListener("input", () => {
      global.value = Number(slider.value);
      host.preview();
    });
    wrap.append(slider);
  } else if (type === "LIST") {
    const picker = document.createElement("select");
    for (const part of String(global.entries || "").split(",")) {
      const [value, label] = part.split("##");
      const option = document.createElement("option");
      option.value = (value || "").trim();
      option.textContent = (label || value || "").trim();
      picker.append(option);
    }
    picker.value = String(global.value ?? "");
    picker.addEventListener("change", () => {
      global.value = picker.value;
      host.preview();
    });
    wrap.append(picker);
  } else {
    const box = input(String(global.value ?? ""));
    box.addEventListener("input", () => {
      global.value = box.value;
      host.preview();
    });
    wrap.append(box);
  }
  return wrap;
}

function globalEditor(key: string, global: GlobalDef, list: Record<string, GlobalDef>, host: StudioHost): HTMLElement {
  const card = document.createElement("div");
  card.className = "global";
  const head = document.createElement("header");
  const title = document.createElement("b");
  title.textContent = key;
  head.append(
    title,
    action("Up", () => {
      host.pushHistory();
      moveGlobal(list, key, -1);
      host.refresh();
    }),
    action("Down", () => {
      host.pushHistory();
      moveGlobal(list, key, 1);
      host.refresh();
    }),
    action(
      "Remove",
      () => {
        host.pushHistory();
        delete list[key];
        host.refresh();
      },
      true,
    ),
  );
  card.append(head);
  const name = input(String(global.title ?? ""));
  bind(name, host, () => {
    global.title = name.value;
  });
  const type = select(
    ["COLOR", "NUMBER", "TEXT", "SWITCH", "LIST"].map((item) => [item, item] as [string, string]),
    String(global.type || "TEXT").toUpperCase(),
  );
  type.addEventListener("change", () => {
    host.pushHistory();
    global.type = type.value;
    host.refresh();
  });
  card.append(field("Title", name), field("Type", type));
  if (String(global.type).toUpperCase() === "NUMBER") {
    const min = input(String(global.min ?? 0));
    const max = input(String(global.max ?? 100));
    bind(min, host, () => {
      global.min = Number(min.value);
    });
    bind(max, host, () => {
      global.max = Number(max.value);
    });
    card.append(field("Min", min), field("Max", max));
  }
  if (String(global.type).toUpperCase() === "LIST") {
    const entries = document.createElement("textarea");
    entries.value = String(global.entries ?? "");
    bind(entries, host, () => {
      global.entries = entries.value;
    });
    card.append(field("Entries val##Label", entries));
  }
  return card;
}

function animCard(anim: Record<string, unknown>, index: number, list: Record<string, unknown>[], host: StudioHost): HTMLElement {
  const card = document.createElement("div");
  card.className = "global";
  const type = select(REACT.map((item) => [item, item] as [string, string]), String(anim.type || "LOOP"));
  const actionName = select(ACTIONS.map((item) => [item, item] as [string, string]), String(anim.action || "FADE"));
  const ease = select(EASES.map((item) => [item, item] as [string, string]), String(anim.ease || "EASE"));
  const duration = input(String(anim.duration ?? 2));
  const delay = input(String(anim.delay ?? 0));
  const formula = input(String(anim.formula ?? ""));
  const amount = input(String(anim.amount ?? ""));
  const angle = input(String(anim.angle ?? ""));
  const flag = input(String(anim.switch ?? ""));
  const write = () => {
    anim.type = type.value;
    anim.action = actionName.value;
    anim.ease = ease.value;
    anim.duration = Number(duration.value);
    anim.delay = Number(delay.value);
    if (formula.value.trim()) anim.formula = formula.value.trim();
    else delete anim.formula;
    if (amount.value.trim()) anim.amount = Number(amount.value);
    else delete anim.amount;
    if (angle.value.trim()) anim.angle = Number(angle.value);
    else delete anim.angle;
    if (flag.value.trim()) anim.switch = flag.value.trim();
    else delete anim.switch;
  };
  for (const el of [type, actionName, ease]) el.addEventListener("change", () => {
    host.pushHistory();
    write();
    host.refresh();
  });
  for (const el of [duration, delay, formula, amount, angle, flag]) bind(el, host, write);
  card.append(
    field("React on", type),
    field("Action", actionName),
    field("Ease", ease),
    field("Duration (seconds)", duration),
    field("Delay", delay),
    field("Formula", formula),
    field("Amount", amount),
    field("Angle", angle),
    field("Switch", flag),
    action(
      "Remove",
      () => {
        host.pushHistory();
        list.splice(index, 1);
        host.refresh();
      },
      true,
    ),
  );
  return card;
}

function eventCard(event: KEvent, index: number, list: KEvent[], host: StudioHost): HTMLElement {
  const card = document.createElement("div");
  card.className = "global";
  const gesture = select(GESTURES.map((item) => [item, item] as [string, string]), event.type || "SINGLE_TAP");
  const actionName = select(EVENT_ACTIONS.map((item) => [item, item] as [string, string]), event.action || "SWITCH_GLOBAL");
  const key = input(event.switch || "");
  const listValue = input(event.switch_list || "");
  const music = select(MUSIC.map((item) => [item, item] as [string, string]), event.music_action || "TOGGLE");
  const url = input(event.url || "");
  const intent = input(event.intent || "");
  const write = () => {
    event.type = gesture.value;
    event.action = actionName.value;
    event.switch = key.value.trim();
    event.switch_list = listValue.value.trim();
    event.music_action = music.value;
    event.url = url.value.trim();
    event.intent = intent.value.trim();
  };
  for (const el of [gesture, actionName, music]) {
    el.addEventListener("change", () => {
      host.pushHistory();
      write();
      host.refresh();
    });
  }
  for (const el of [key, listValue, url, intent]) bind(el, host, write);
  const globals = host.preset.preset_root.globals_list ?? (host.preset.preset_root.globals_list = {});
  card.append(
    field("Gesture", gesture),
    field("Action", actionName),
    field("Global", key),
    field("List value", listValue),
    field("Music", music),
    field("URL", url),
    field("Intent", intent),
    action("Try", () => {
      host.pushHistory();
      write();
      host.status(applyEvent(event, host.device, globals));
      host.refresh();
    }),
    action(
      "Remove",
      () => {
        host.pushHistory();
        list.splice(index, 1);
        host.refresh();
      },
      true,
    ),
  );
  note(card, describeEvent(event));
  return card;
}

function gradient(root: HTMLElement, mod: KModule, host: StudioHost) {
  const mode = select(
    [
      ["", "None"],
      ["VERTICAL", "Vertical"],
      ["HORIZONTAL", "Horizontal"],
      ["RADIAL", "Radial"],
    ],
    String(mod.fx_gradient || ""),
  );
  const color = input(String(mod.fx_gradient_color || "#FF000000"));
  const offset = input(String(mod.fx_gradient_offset ?? 100));
  mode.addEventListener("change", () => {
    host.pushHistory();
    if (!mode.value) delete mod.fx_gradient;
    else mod.fx_gradient = mode.value;
    host.refresh();
  });
  bind(color, host, () => {
    mod.fx_gradient_color = color.value;
  });
  bind(offset, host, () => {
    mod.fx_gradient_offset = Number(offset.value);
  });
  root.append(field("Gradient", mode), field("Second color", color), field("Offset", offset));
}

function colorEditor(hex: string, write: (hex: string) => void, host: StudioHost): HTMLElement {
  const wrap = document.createElement("div");
  const parsed = toHex8(hex);
  const alpha = range(parseInt(parsed.slice(1, 3), 16), 0, 255, 1);
  const picker = document.createElement("input");
  picker.type = "color";
  picker.value = rgbHex(parsed);
  const box = input(parsed);
  const push = () => {
    const rgb = picker.value.slice(1).toUpperCase();
    const next = `#${Number(alpha.value).toString(16).padStart(2, "0")}${rgb}`.toUpperCase();
    box.value = next;
    write(next);
  };
  alpha.addEventListener("pointerdown", () => host.pushHistory());
  picker.addEventListener("pointerdown", () => host.pushHistory());
  alpha.addEventListener("input", push);
  picker.addEventListener("input", push);
  bind(box, host, () => write(toHex8(box.value)));
  wrap.append(field("Alpha", alpha), field("Color", picker), field("Hex", box));
  return wrap;
}

function inputView(mod: KModule, host: StudioHost): HTMLElement {
  const box = document.createElement("div");
  const keys = ["text_expression", "paint_color", "text_size", "shape_width", "shape_height", "style_size", "progress_progress", "config_visible"];
  for (const key of keys) {
    const info = host.readProp(key);
    if (!info.raw && info.mode === "value") continue;
    const row = document.createElement("div");
    row.className = "resolved";
    row.textContent = `${key}\n${info.raw || "—"}\n→ ${info.value}`;
    box.append(row);
  }
  const blob = JSON.stringify({
    text: mod.text_expression,
    formulas: mod.internal_formulas,
    animations: mod.internal_animations,
  });
  const names = new Set<string>();
  for (const match of blob.matchAll(/gv\(\s*["']?([A-Za-z0-9_]+)/g)) names.add(match[1]!);
  if (names.size) {
    note(box, "Globals this item reads");
    const list = host.preset.preset_root.globals_list ?? {};
    for (const name of names) {
      const global = list[name];
      const row = input(global ? String(global.value ?? "") : "");
      row.addEventListener("change", () => {
        if (!list[name]) return;
        host.pushHistory();
        list[name]!.value = coerce(row.value);
        host.refresh();
      });
      box.append(field(name, row));
    }
  }
  return box;
}

function toolButton(item: Tool, host: StudioHost): HTMLElement {
  const row = document.createElement("div");
  row.className = "tool";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-main";
  const name = document.createElement("b");
  name.textContent = item.name;
  const blurb = document.createElement("span");
  blurb.textContent = item.blurb;
  button.append(name, blurb);
  button.addEventListener("click", () => host.insertTool(item));
  row.append(button);
  if (item.id.startsWith("custom-")) {
    row.append(
      action(
        "×",
        () => {
          deleteCustomTool(item.id);
          host.refresh();
        },
        true,
      ),
    );
  }
  return row;
}

function chips(area: HTMLTextAreaElement | HTMLInputElement): HTMLElement {
  const wrap = document.createElement("div");
  let last = "";
  for (const snippet of formulaSnippets()) {
    if (snippet.group !== last) {
      const label = document.createElement("span");
      label.className = "hint chip-label";
      label.textContent = snippet.group;
      wrap.append(label);
      last = snippet.group;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = snippet.label;
    button.addEventListener("click", () => {
      const start = area.selectionStart ?? area.value.length;
      const end = area.selectionEnd ?? start;
      area.value = area.value.slice(0, start) + snippet.insert + area.value.slice(end);
      area.focus();
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    wrap.append(button);
  }
  wrap.className = "chips";
  return wrap;
}

function result(host: StudioHost, source: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "resolved";
  el.textContent = host.evalSource(source);
  return el;
}

function properties(mod: KModule): { key: string; label: string }[] {
  const type = mod.internal_type;
  const items = [{ key: "paint_color", label: "Color" }, { key: "config_visible", label: "Visible" }];
  if (type === "TextModule") items.unshift({ key: "text_expression", label: "Text" }, { key: "text_size", label: "Text size" });
  if (type === "ShapeModule" || type === "ProgressModule") items.push({ key: "shape_width", label: "Width" }, { key: "shape_height", label: "Height" });
  if (type === "ProgressModule") items.push({ key: "style_size", label: "Size" }, { key: "progress_progress", label: "Progress" });
  return items;
}

function needItem(root: HTMLElement, host: StudioHost): KModule | null {
  if (!host.module || host.module.internal_type === "RootLayerModule") {
    note(root, "Select an item on the phone.");
    return null;
  }
  return host.module;
}

function ordered(list: Record<string, GlobalDef>): [string, GlobalDef][] {
  return Object.entries(list).sort((a, b) => Number(a[1].index ?? 0) - Number(b[1].index ?? 0));
}

function moveGlobal(list: Record<string, GlobalDef>, key: string, dir: number) {
  const keys = ordered(list).map(([name]) => name);
  const index = keys.indexOf(key);
  const next = index + dir;
  if (index < 0 || next < 0 || next >= keys.length) return;
  const swapped = keys[next]!;
  keys[next] = keys[index]!;
  keys[index] = swapped;
  keys.forEach((name, position) => {
    list[name]!.index = position + 1;
  });
}

function freshKey(list: Record<string, GlobalDef>): string {
  let n = 1;
  while (list[`g${n}`]) n++;
  return `g${n}`;
}

function wrapFormula(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("$")) return trimmed;
  return `$${trimmed}$`;
}

function quoteFormula(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("$")) return trimmed;
  if (Number.isFinite(Number(trimmed))) return trimmed;
  return `"${trimmed.replaceAll('"', '\\"')}"`;
}

function coerce(value: string): string | number {
  if (value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return value;
}

function bind(el: HTMLInputElement | HTMLTextAreaElement, host: StudioHost, apply: () => void, shown?: HTMLElement) {
  let armed = false;
  el.addEventListener("focus", () => {
    if (!armed) {
      host.pushHistory();
      armed = true;
    }
  });
  el.addEventListener("blur", () => {
    armed = false;
  });
  el.addEventListener("input", () => {
    apply();
    host.preview();
    if (shown) shown.textContent = host.evalSource(el.value);
  });
}

function field(label: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const caption = document.createElement("span");
  caption.textContent = label;
  wrap.append(caption, control);
  return wrap;
}

function note(parent: HTMLElement, text: string) {
  const el = document.createElement("p");
  el.className = "hint";
  el.textContent = text;
  parent.append(el);
  return el;
}

function action(label: string, run: () => void, danger = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (danger) button.className = "danger";
  button.addEventListener("click", () => run());
  return button;
}

function input(value: string): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  return el;
}

function range(value: number, min: number, max: number, step: number): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "range";
  el.min = String(min);
  el.max = String(max);
  el.step = String(step);
  el.value = String(value);
  return el;
}

function check(label: string, value: boolean, apply: (value: boolean) => void): HTMLElement {
  const row = document.createElement("label");
  row.className = "field row";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = value;
  box.addEventListener("change", () => apply(box.checked));
  row.append(box, document.createTextNode(" " + label));
  return row;
}

function select(options: [string, string][], value: string): HTMLSelectElement {
  const el = document.createElement("select");
  for (const [optionValue, label] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    el.append(option);
  }
  if (Array.from(el.options).some((option) => option.value === value)) el.value = value;
  return el;
}
