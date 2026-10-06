import { animationFrame, combineFrames, frameTransform, isRest, REST_FRAME, type AnimEnv, type AnimFrame } from "./advanced/animate";
import { applyEvent, type KEvent } from "./advanced/events";
import { paintAnimate, paintColor, paintEvents, paintForm, paintFormula, paintSource, renderToolList, type StudioHost } from "./advanced/panel";
import type { Tool } from "./advanced/tools";
import { deviceNow, defaultDevice } from "./device";
import { evalLoose, globalValue, makeCtx, stringify } from "./formula/eval";
import { readFile, writeArchive } from "./io";
import { isContainer, layoutPreset, pathKey, positionWrites, presetSize, type MeasureFn } from "./layout";
import { moduleAt, parentAt, setLiteral } from "./props";
import { presetCatalog } from "./presets";
import { blankPreset, harborPreset } from "./sample";
import type { Device, GlobalDef, KModule, Preset, SceneNode } from "./types";

type Tab = "item" | "globals" | "preview" | "formula" | "form" | "animate" | "color" | "events" | "source";
type Side = "layers" | "tools";

type EditorState = {
  preset: Preset;
  assets: Record<string, Uint8Array>;
  filename: string;
  selection: number[];
  device: Device;
  showBounds: boolean;
  zoom: number;
  status: string;
  undo: string[];
  redo: string[];
  fonts: Record<string, string>;
  dirty: boolean;
  tab: Tab;
  hidden: Set<string>;
  fieldUndo: boolean;
  advanced: boolean;
  side: Side;
  interact: boolean;
  scroll: number;
  unlocked: boolean;
  unlockAt: number;
  dragging: boolean;
};

const state: EditorState = {
  preset: harborPreset(),
  assets: {},
  filename: "Harbor.klwp",
  selection: [],
  device: defaultDevice(),
  showBounds: false,
  zoom: 0,
  status: "Drag items on the phone. The preview reacts to formulas.",
  undo: [],
  redo: [],
  fonts: {},
  dirty: false,
  tab: "item",
  hidden: new Set(),
  fieldUndo: false,
  advanced: false,
  side: "layers",
  interact: false,
  scroll: 0,
  unlocked: false,
  unlockAt: 0,
  dragging: false,
};

let scene: SceneNode[] = [];
const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d")!;

const measure: MeasureFn = (text, size, family) => {
  measureCtx.font = `${size}px ${family}`;
  const lines = (text.length ? text : " ").split("\n");
  let width = 0;
  for (const line of lines) width = Math.max(width, measureCtx.measureText(line || " ").width);
  return { w: Math.ceil(width + 4), h: Math.ceil(lines.length * size * 1.05) };
};

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header>
    <div class="brand"><span class="mark"></span><div><strong>Kustom</strong><em>Live wallpaper</em></div></div>
    <div class="filename" id="filename"></div>
    <div class="toolbar">
      <button id="blank" type="button">Blank</button>
      <div class="preset-wrap">
        <button id="presets" type="button">Presets</button>
        <div id="preset-menu" class="preset-menu" hidden></div>
      </div>
      <button id="open" type="button">Open</button>
      <button id="advanced" type="button">Advanced</button>
      <button id="export" class="primary" type="button">Export .klwp</button>
      <input id="file" type="file" accept=".klwp,.zip,.json,application/json,application/zip" />
    </div>
  </header>
  <div class="workspace">
    <aside class="layers">
      <div class="panel-label">Layers</div>
      <div class="panel-switch" id="panel-switch" hidden>
        <button type="button" data-side="layers" class="on">Layers</button>
        <button type="button" data-side="tools">Tools</button>
      </div>
      <div id="layer-list"></div>
      <div id="tool-list" hidden></div>
      <div class="add-row">
        <button type="button" data-add="text">Text</button>
        <button type="button" data-add="rect">Rectangle</button>
        <button type="button" data-add="circle">Circle</button>
        <button type="button" data-add="group">Group</button>
        <button type="button" data-add="stack">Stack</button>
      </div>
    </aside>
    <main class="stage-wrap" id="stage-wrap"><div class="phone" id="phone"><div id="stage"></div></div></main>
    <aside class="inspector">
      <div class="tabs">
        <button type="button" data-tab="item">Item</button>
        <button type="button" data-tab="globals">Globals</button>
        <button type="button" data-tab="preview">Preview</button>
      </div>
      <div class="tabs advanced-tabs" id="advanced-tabs" hidden>
        <button type="button" data-tab="formula">Formula</button>
        <button type="button" data-tab="form">Form</button>
        <button type="button" data-tab="animate">Animate</button>
        <button type="button" data-tab="color">Color</button>
        <button type="button" data-tab="events">Events</button>
        <button type="button" data-tab="source">Source</button>
      </div>
      <div id="tab-body"></div>
    </aside>
  </div>
  <footer>
    <span id="status"></span>
    <span class="spacer"></span>
    <label><input id="interact" type="checkbox" /> Interact</label>
    <label><input id="bounds" type="checkbox" /> Bounds</label>
    <label>Zoom <input id="zoom" type="range" min="0" max="160" value="0" /></label>
    <span id="zoom-label">Fit</span>
  </footer>
`;

const stage = document.querySelector<HTMLDivElement>("#stage")!;
const phone = document.querySelector<HTMLDivElement>("#phone")!;
const layerList = document.querySelector<HTMLDivElement>("#layer-list")!;
const tabBody = document.querySelector<HTMLDivElement>("#tab-body")!;
const fileInput = document.querySelector<HTMLInputElement>("#file")!;

document.querySelector("#blank")!.addEventListener("click", () => replaceDocument(blankPreset(), {}, "Untitled.klwp"));
const presetMenu = document.querySelector<HTMLDivElement>("#preset-menu")!;
for (const entry of presetCatalog()) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.preset = entry.id;
  const title = document.createElement("strong");
  title.textContent = entry.title;
  const blurb = document.createElement("span");
  blurb.textContent = entry.blurb;
  button.append(title, blurb);
  button.addEventListener("click", () => {
    replaceDocument(entry.build(), {}, entry.filename);
    presetMenu.hidden = true;
    if (state.filename === entry.filename) state.status = `${entry.title}. ${entry.blurb}`;
  });
  presetMenu.append(button);
}
document.querySelector("#presets")!.addEventListener("click", (event) => {
  event.stopPropagation();
  presetMenu.hidden = !presetMenu.hidden;
  const current = state.preset.preset_info?.title;
  for (const button of Array.from(presetMenu.querySelectorAll("button"))) {
    button.classList.toggle("on", button.querySelector("strong")?.textContent === current);
  }
});
document.addEventListener("click", (event) => {
  if (!(event.target as HTMLElement).closest(".preset-wrap")) presetMenu.hidden = true;
});
document.querySelector("#open")!.addEventListener("click", () => fileInput.click());
document.querySelector("#export")!.addEventListener("click", () => exportKlwp());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (file) void openFile(file);
});
document.querySelector("#bounds")!.addEventListener("change", (event) => {
  state.showBounds = (event.target as HTMLInputElement).checked;
  paintStage();
});
document.querySelector("#zoom")!.addEventListener("input", (event) => {
  state.zoom = Number((event.target as HTMLInputElement).value);
  paintStage();
  document.querySelector("#zoom-label")!.textContent = state.zoom === 0 ? "Fit" : `${state.zoom}%`;
});
document.querySelector(".inspector")!.addEventListener("click", (event) => {
  const tab = (event.target as HTMLElement).closest("button")?.dataset.tab as Tab | undefined;
  if (!tab) return;
  state.tab = tab;
  paintTabs();
  paintInspector(true);
});
document.querySelector("#advanced")!.addEventListener("click", () => {
  state.advanced = !state.advanced;
  if (state.advanced) {
    state.side = "tools";
    if (state.tab === "item" || state.tab === "globals" || state.tab === "preview") state.tab = "formula";
    state.status = "Advanced builder. Pick a tool, then edit its formula, form, motion, color, events, or source.";
  } else {
    state.side = "layers";
    if (!["item", "globals", "preview"].includes(state.tab)) state.tab = "item";
    state.status = "Drag items on the phone. The preview reacts to formulas.";
  }
  renderAll(true);
});
document.querySelector("#panel-switch")!.addEventListener("click", (event) => {
  const side = (event.target as HTMLElement).dataset.side as Side | undefined;
  if (!side) return;
  state.side = side;
  renderAll(true);
});
document.querySelector("#interact")!.addEventListener("change", (event) => {
  state.interact = (event.target as HTMLInputElement).checked;
  state.status = state.interact ? "Interact is on. Taps run events instead of dragging." : "Taps select and drag.";
  paintChrome();
});
document.querySelector(".add-row")!.addEventListener("click", (event) => {
  const kind = (event.target as HTMLElement).dataset.add;
  if (kind) addModule(kind);
});

window.addEventListener("keydown", onKey);
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) void openFile(file);
});
new ResizeObserver(() => paintStage()).observe(document.querySelector("#stage-wrap")!);
window.setInterval(() => {
  if (!state.device.useRealTime) return;
  relayout();
  paintStage();
  const resolved = document.querySelector("#resolved");
  const node = selectedNode();
  if (resolved && node?.kind === "text") resolved.textContent = node.text;
}, 1000);

stage.addEventListener("pointerdown", (event) => {
  if (event.target === stage) select([]);
});

function replaceDocument(preset: Preset, assets: Record<string, Uint8Array>, filename: string) {
  if (state.dirty && !confirm("Discard unsaved changes?")) return;
  state.preset = preset;
  state.assets = assets;
  state.filename = filename;
  state.selection = [];
  state.undo = [];
  state.redo = [];
  state.hidden.clear();
  state.dirty = false;
  state.status = `Opened ${filename}`;
  void loadFonts();
  renderAll(true);
}

async function openFile(file: File) {
  if (state.dirty && !confirm("Discard unsaved changes?")) return;
  try {
    const loaded = await readFile(file);
    state.preset = loaded.preset;
    state.assets = loaded.assets;
    state.filename = file.name.toLowerCase().endsWith(".json") ? file.name.replace(/\.json$/i, ".klwp") : file.name;
    state.selection = [];
    state.undo = [];
    state.redo = [];
    state.hidden.clear();
    state.dirty = false;
    state.status = `Opened ${file.name}`;
    await loadFonts();
    renderAll(true);
  } catch (error) {
    state.status = error instanceof Error ? error.message : "Could not open that file.";
    paintStatus();
  }
}

async function loadFonts() {
  const fonts: Record<string, string> = {};
  for (const [path, bytes] of Object.entries(state.assets)) {
    if (!/\.(ttf|otf)$/i.test(path)) continue;
    const family = "KFont_" + path.replace(/[^\w]+/g, "_");
    try {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const face = new FontFace(family, copy.buffer);
      await face.load();
      (document.fonts as unknown as { add(font: FontFace): void }).add(face);
      fonts[(path.split("/").pop() ?? path).toLowerCase()] = family;
    } catch {
      state.status = `Could not load font ${path}`;
    }
  }
  state.fonts = fonts;
}

function resolveFont(spec: string): string {
  const base = (spec.split("/").pop() ?? "").toLowerCase();
  const loaded = state.fonts[base];
  if (loaded) return `"${loaded}", ui-monospace, monospace`;
  if (/mono|fixed/i.test(spec)) return '"IBM Plex Mono", ui-monospace, monospace';
  return "Roboto, sans-serif";
}

function exportKlwp() {
  const bytes = writeArchive(state.preset, state.assets);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.filename.toLowerCase().endsWith(".klwp") ? state.filename : `${state.filename}.klwp`;
  link.click();
  URL.revokeObjectURL(url);
  state.dirty = false;
  state.status = `Exported ${link.download}`;
  paintChrome();
}

function pushHistory() {
  state.undo.push(JSON.stringify(state.preset));
  if (state.undo.length > 50) state.undo.shift();
  state.redo = [];
  state.dirty = true;
}

function undo() {
  const previous = state.undo.pop();
  if (!previous) return;
  state.redo.push(JSON.stringify(state.preset));
  state.preset = JSON.parse(previous) as Preset;
  if (!moduleAt(state.preset.preset_root, state.selection)) state.selection = [];
  state.status = "Undid the last change";
  renderAll(true);
}

function redo() {
  const next = state.redo.pop();
  if (!next) return;
  state.undo.push(JSON.stringify(state.preset));
  state.preset = JSON.parse(next) as Preset;
  if (!moduleAt(state.preset.preset_root, state.selection)) state.selection = [];
  state.status = "Redid the last change";
  renderAll(true);
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const typing = target.matches("input, textarea, select");
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if (typing) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicate();
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    removeSelected();
    return;
  }
  if (event.key === "Escape") select([]);
  const nudge = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowLeft") nudgeSelected(-nudge, 0);
  if (event.key === "ArrowRight") nudgeSelected(nudge, 0);
  if (event.key === "ArrowUp") nudgeSelected(0, -nudge);
  if (event.key === "ArrowDown") nudgeSelected(0, nudge);
}

function relayout() {
  state.device.now = deviceNow(state.device);
  scene = layoutPreset(state.preset, state.device, {
    measure,
    fontFamily: resolveFont,
    editorHidden: state.hidden,
  });
}

function renderAll(inspector = false) {
  relayout();
  paintChrome();
  paintLayers();
  paintTools(inspector);
  paintStage();
  paintTabs();
  paintInspector(inspector);
}

function paintChrome() {
  const info = state.preset.preset_info;
  const { w, h } = presetSize(state.preset);
  document.querySelector("#filename")!.innerHTML = `<b>${escapeHtml(info?.title || "Untitled")}</b> · ${escapeHtml(state.filename)}${state.dirty ? " · edited" : ""}`;
  document.querySelector("#status")!.textContent = `${state.status}  ·  ${w}×${h}  ·  ${countModules(state.preset.preset_root)} items`;
}

function paintStatus() {
  paintChrome();
}

function paintTabs() {
  document.querySelector<HTMLElement>("#advanced-tabs")!.hidden = !state.advanced;
  document.querySelector("#advanced")!.classList.toggle("on", state.advanced);
  document.querySelector(".workspace")!.classList.toggle("advanced", state.advanced);
  document.querySelector<HTMLElement>("#panel-switch")!.hidden = !state.advanced;
  document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((button) => {
    button.classList.toggle("on", button.dataset.tab === state.tab);
  });
  document.querySelectorAll<HTMLButtonElement>("#panel-switch button").forEach((button) => {
    button.classList.toggle("on", button.dataset.side === state.side);
  });
}

function paintTools(force = false) {
  const list = document.querySelector<HTMLElement>("#tool-list")!;
  const show = state.advanced && state.side === "tools";
  list.hidden = !show;
  layerList.hidden = show;
  document.querySelector<HTMLElement>(".add-row")!.hidden = show;
  if (!show || (!force && list.contains(document.activeElement))) return;
  renderToolList(list, studio());
}

function paintLayers() {
  const scroll = layerList.scrollTop;
  layerList.replaceChildren();
  const walk = (mod: KModule, path: number[], depth: number) => {
    const key = pathKey(path);
    const node = scene.find((item) => pathKey(item.path) === key);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "layer" + (samePath(path, state.selection) ? " on" : "") + (state.hidden.has(key) ? " dim" : "");
    row.style.paddingLeft = `${8 + depth * 14}px`;
    const eye = document.createElement("span");
    eye.className = "eye";
    eye.textContent = state.hidden.has(key) ? "○" : "●";
    eye.title = "Hide in the editor";
    eye.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.hidden.has(key)) state.hidden.delete(key);
      else state.hidden.add(key);
      renderAll(false);
    });
    const swatch = document.createElement("i");
    swatch.className = "swatch";
    swatch.style.background = node?.css.background || node?.css.color || "transparent";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = String(mod.internal_title || node?.typeName || "Item");
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = node?.typeName || "";
    row.append(eye, swatch, name, kind);
    row.addEventListener("click", () => select(path));
    layerList.append(row);
    mod.viewgroup_items?.forEach((child, index) => walk(child, path.concat(index), depth + 1));
  };
  walk(state.preset.preset_root, [], 0);
  layerList.scrollTop = scroll;
}

function paintStage() {
  relayout();
  const motionEnv = animEnv();
  const { w, h } = presetSize(state.preset);
  const scale = currentScale(w, h);
  phone.style.width = `${w * scale}px`;
  phone.style.height = `${h * scale}px`;
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
  stage.style.transform = `scale(${scale})`;
  stage.replaceChildren();
  for (const node of scene) {
    if (node.removed || node.kind === "root") continue;
    if (node.hidden) continue;
    if (node.kind === "group" && !state.showBounds && !samePath(node.path, state.selection)) continue;
    const el = document.createElement("div");
    el.className = `node ${node.kind}` + (samePath(node.path, state.selection) ? " selected" : "");
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${Math.max(node.w, 1)}px`;
    el.style.height = `${Math.max(node.h, 1)}px`;
    el.dataset.path = pathKey(node.path);
    if (node.kind === "text") {
      el.style.fontSize = `${node.fontSize}px`;
      el.style.fontFamily = node.fontFamily;
      el.style.color = node.css.color || "#fff";
      el.innerHTML = node.html || escapeHtml(node.text);
    } else if (node.kind === "shape") {
      Object.assign(el.style, node.css);
    } else if (node.typeName === "Image") {
      el.classList.add("bitmap");
      el.textContent = "Image";
    }
    paintMotion(el, node, motionEnv);
    el.addEventListener("pointerdown", (event) => onNodePointerDown(event, node.path));
    stage.append(el);
  }
  const selected = selectedNode();
  if (selected && selected.kind !== "root" && !selected.removed && !selected.hidden) {
    for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
      const grip = document.createElement("div");
      grip.className = "handle";
      grip.dataset.handle = handle;
      const point = handlePoint(selected, handle, scale);
      grip.style.left = `${point.x}px`;
      grip.style.top = `${point.y}px`;
      grip.addEventListener("pointerdown", (event) => onResizeDown(event, selected.path, handle));
      stage.append(grip);
    }
  }
}

function handlePoint(node: SceneNode, handle: string, scale: number): { x: number; y: number } {
  const x = handle.includes("w") ? node.x : handle.includes("e") ? node.x + node.w : node.x + node.w / 2;
  const y = handle.includes("n") ? node.y : handle.includes("s") ? node.y + node.h : node.y + node.h / 2;
  return { x, y };
  void scale;
}

function currentScale(w: number, h: number): number {
  if (state.zoom > 0) return state.zoom / 100;
  const wrap = document.querySelector<HTMLElement>("#stage-wrap")!;
  const availW = Math.max(120, wrap.clientWidth - 64);
  const availH = Math.max(120, wrap.clientHeight - 64);
  return Math.max(0.15, Math.min(availW / w, availH / h));
}

function onNodePointerDown(event: PointerEvent, path: number[]) {
  event.stopPropagation();
  if (event.altKey) {
    const hits = document
      .elementsFromPoint(event.clientX, event.clientY)
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("node") && Boolean(el.dataset.path));
    const index = hits.findIndex((el) => el.dataset.path === pathKey(path));
    const next = hits[(index + 1) % hits.length];
    if (next?.dataset.path) select(next.dataset.path.split(".").filter(Boolean).map(Number));
    return;
  }
  const target = dragTarget(path);
  const tapped = moduleAt(state.preset.preset_root, path);
  if (state.interact && tapped?.internal_events?.length) {
    select(path);
    pushHistory();
    const globals = state.preset.preset_root.globals_list ?? (state.preset.preset_root.globals_list = {});
    const messages = tapped.internal_events.map((event) => applyEvent(event as KEvent, state.device, globals));
    state.status = messages.filter(Boolean).join(" · ") || "Event";
    renderAll(true);
    return;
  }
  select(target);
  state.dragging = true;
  if (target.length === 0) return;
  const node = scene.find((item) => samePath(item.path, target));
  const parent = parentNode(target);
  if (!node || !parent) return;
  const start = point(event);
  const origin = { x: node.x - parent.x, y: node.y - parent.y };
  const mod = moduleAt(state.preset.preset_root, target);
  if (!mod) return;
  let history = false;
  const move = (ev: PointerEvent) => {
    const now = point(ev);
    const dx = now.x - start.x;
    const dy = now.y - start.y;
    if (!history && Math.hypot(dx, dy) < 2) return;
    if (!history) {
      pushHistory();
      history = true;
    }
    const snap = ev.shiftKey ? 10 : 1;
    writePosition(mod, parent, origin.x + dx, origin.y + dy, node.w, node.h, snap);
    if (pathKey(target) !== pathKey(path)) state.status = "Moved the stack. Items inside a stack stay in flow order.";
    relayout();
    paintStage();
    paintLayers();
    syncCoordinates();
  };
  const up = () => {
    state.dragging = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (history) paintInspector(true);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function onResizeDown(event: PointerEvent, path: number[], handle: string) {
  event.stopPropagation();
  event.preventDefault();
  const node = scene.find((item) => samePath(item.path, path));
  const parent = parentNode(path);
  const mod = moduleAt(state.preset.preset_root, path);
  if (!node || !parent || !mod) return;
  state.dragging = true;
  const start = point(event);
  const origin = { x: node.x, y: node.y, w: node.w, h: node.h, size: node.fontSize };
  let history = false;
  const move = (ev: PointerEvent) => {
    const now = point(ev);
    const dx = now.x - start.x;
    const dy = now.y - start.y;
    if (!history && Math.hypot(dx, dy) < 2) return;
    if (!history) {
      pushHistory();
      history = true;
    }
    let x = origin.x;
    let y = origin.y;
    let w = origin.w;
    let h = origin.h;
    if (handle.includes("e")) w = origin.w + dx;
    if (handle.includes("s")) h = origin.h + dy;
    if (handle.includes("w")) {
      w = origin.w - dx;
      x = origin.x + dx;
    }
    if (handle.includes("n")) {
      h = origin.h - dy;
      y = origin.y + dy;
    }
    w = Math.max(8, w);
    h = Math.max(8, h);
    if (mod.internal_type === "TextModule") {
      const next = Math.max(8, origin.size * (h / origin.h));
      writeTextSize(mod, next);
    } else {
      setLiteral(mod, "shape_width", Math.round(w));
      setLiteral(mod, "shape_height", Math.round(h));
      if ((mod.shape_type ?? "RECT") === "CIRCLE") setLiteral(mod, "shape_height", Math.round(Math.max(w, h)));
    }
    if (x !== origin.x || y !== origin.y) writePosition(mod, parent, x - parent.x, y - parent.y, w, h, 1);
    relayout();
    paintStage();
  };
  const up = () => {
    state.dragging = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    paintInspector(true);
    paintLayers();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function writePosition(mod: KModule, parent: SceneNode, localX: number, localY: number, w: number, h: number, snap: number) {
  const anchor = String(mod.position_anchor || "CENTER");
  const writes = positionWrites(anchor, parent.w, parent.h, w, h, snapTo(localX, snap), snapTo(localY, snap), 0, 0, 0, 0, 0, 0);
  const keys = [
    "position_padding_left",
    "position_padding_top",
    "position_padding_right",
    "position_padding_bottom",
    "position_offset_x",
    "position_offset_y",
  ];
  let replaced = false;
  for (const key of keys) {
    if (mod.internal_formulas?.[key]) replaced = true;
    if (key in mod || mod.internal_formulas?.[key] || mod.internal_toggles?.[key] != null) setLiteral(mod, key, 0);
  }
  for (const write of writes) setLiteral(mod, write.key, write.value);
  if (!mod.position_anchor) mod.position_anchor = anchor;
  if (replaced) state.status = "Position formula replaced with a fixed value.";
}

function writeTextSize(mod: KModule, size: number) {
  const rounded = Math.round(size * 10) / 10;
  const link = Number(mod.internal_toggles?.text_size) === 100 ? mod.internal_globals?.text_size : "";
  const globals = state.preset.preset_root.globals_list;
  if (link && globals?.[link]) {
    globals[link]!.value = rounded;
    state.status = `Updated global ${globals[link]!.title || link}`;
    return;
  }
  setLiteral(mod, "text_size", rounded);
}

function nudgeSelected(dx: number, dy: number) {
  const path = dragTarget(state.selection);
  const mod = moduleAt(state.preset.preset_root, path);
  const node = scene.find((item) => samePath(item.path, path));
  const parent = parentNode(path);
  if (!mod || !node || !parent || path.length === 0) return;
  pushHistory();
  writePosition(mod, parent, node.x - parent.x + dx, node.y - parent.y + dy, node.w, node.h, 1);
  renderAll(true);
}

function dragTarget(path: number[]): number[] {
  let target = path.slice();
  while (target.length) {
    const parent = moduleAt(state.preset.preset_root, target.slice(0, -1));
    if (parent?.internal_type !== "StackLayerModule") break;
    target = target.slice(0, -1);
  }
  return target;
}

function select(path: number[]) {
  state.selection = path;
  state.tab = state.tab === "preview" ? "preview" : "item";
  renderAll(true);
}

function addModule(kind: string) {
  insertModule(createModule(kind));
}

function insertModule(mod: KModule, globals?: Record<string, GlobalDef>) {
  pushHistory();
  if (globals) {
    const list = state.preset.preset_root.globals_list ?? (state.preset.preset_root.globals_list = {});
    for (const [key, value] of Object.entries(globals)) {
      if (!list[key]) list[key] = structuredClone(value);
    }
  }
  const copy = structuredClone(mod);
  const { parent, base } = containerForInsert();
  parent.viewgroup_items = parent.viewgroup_items ?? [];
  const offset = 18 * (parent.viewgroup_items.length % 5);
  if (typeof copy.position_padding_left === "number") copy.position_padding_left += offset;
  if (typeof copy.position_padding_top === "number") copy.position_padding_top += offset;
  parent.viewgroup_items.push(copy);
  state.selection = base.concat(parent.viewgroup_items.length - 1);
  const advancedTab = ["formula", "form", "animate", "color", "events", "source"].includes(state.tab);
  state.tab = state.advanced ? (advancedTab ? state.tab : "formula") : "item";
  state.status = `Added ${copy.internal_title || "item"}`;
  renderAll(true);
}

function createModule(kind: string): KModule {
  if (kind === "text") {
    return {
      internal_type: "TextModule",
      internal_title: "Text",
      text_expression: "Text",
      text_size: 56,
      paint_color: "#FFF4F7EF",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
    };
  }
  if (kind === "circle") {
    return {
      internal_type: "ShapeModule",
      internal_title: "Circle",
      shape_type: "CIRCLE",
      shape_width: 220,
      shape_height: 220,
      paint_color: "#FFB6F27C",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
    };
  }
  if (kind === "group") {
    return {
      internal_type: "OverlapLayerModule",
      internal_title: "Group",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
      viewgroup_items: [
        {
          internal_type: "ShapeModule",
          internal_title: "Base",
          shape_type: "RECT",
          shape_width: 420,
          shape_height: 260,
          shape_corners: 28,
          paint_color: "#FF243026",
          position_anchor: "CENTER",
        },
      ],
    };
  }
  if (kind === "stack") {
    return {
      internal_type: "StackLayerModule",
      internal_title: "Stack",
      position_anchor: "TOPLEFT",
      position_padding_left: 80,
      position_padding_top: 80,
      config_stacking: "VERTICAL",
      config_margin: 8,
      viewgroup_items: [
        {
          internal_type: "TextModule",
          internal_title: "Line",
          text_expression: "First",
          text_size: 36,
          paint_color: "#FFF4F7EF",
        },
        {
          internal_type: "TextModule",
          internal_title: "Line",
          text_expression: "Second",
          text_size: 36,
          paint_color: "#FFB7C3B0",
        },
      ],
    };
  }
  return {
    internal_type: "ShapeModule",
    internal_title: "Rectangle",
    shape_type: "RECT",
    shape_width: 320,
    shape_height: 180,
    shape_corners: 24,
    paint_color: "#FFB6F27C",
    position_anchor: "TOPLEFT",
    position_padding_left: 80,
    position_padding_top: 80,
  };
}

function containerForInsert(): { parent: KModule; base: number[] } {
  const root = state.preset.preset_root;
  const selected = moduleAt(root, state.selection);
  if (selected && isContainer(selected)) return { parent: selected, base: state.selection.slice() };
  const up = parentAt(root, state.selection);
  if (up) return { parent: up.parent, base: state.selection.slice(0, -1) };
  return { parent: root, base: [] };
}

function removeSelected() {
  const loc = parentAt(state.preset.preset_root, state.selection);
  if (!loc?.parent.viewgroup_items) return;
  pushHistory();
  loc.parent.viewgroup_items.splice(loc.index, 1);
  state.selection = state.selection.slice(0, -1);
  state.status = "Deleted the item";
  renderAll(true);
}

function duplicate() {
  const loc = parentAt(state.preset.preset_root, state.selection);
  if (!loc?.parent.viewgroup_items) return;
  pushHistory();
  const clone = structuredClone(loc.parent.viewgroup_items[loc.index]!);
  clone.internal_title = `${clone.internal_title || "Item"} copy`;
  if (typeof clone.position_padding_left === "number") clone.position_padding_left += 24;
  if (typeof clone.position_padding_top === "number") clone.position_padding_top += 24;
  else clone.position_offset_y = Number(clone.position_offset_y ?? 0) + 24;
  loc.parent.viewgroup_items.splice(loc.index + 1, 0, clone);
  state.selection = state.selection.slice(0, -1).concat(loc.index + 1);
  state.status = "Duplicated the item";
  renderAll(true);
}

function moveZ(direction: number) {
  const loc = parentAt(state.preset.preset_root, state.selection);
  if (!loc?.parent.viewgroup_items) return;
  const next = loc.index + direction;
  if (next < 0 || next >= loc.parent.viewgroup_items.length) return;
  pushHistory();
  const [item] = loc.parent.viewgroup_items.splice(loc.index, 1);
  loc.parent.viewgroup_items.splice(next, 0, item!);
  state.selection = state.selection.slice(0, -1).concat(next);
  renderAll(true);
}

function paintInspector(force: boolean) {
  if (!force && tabBody.contains(document.activeElement)) return;
  tabBody.replaceChildren();
  const host = studio();
  if (state.tab === "globals") paintGlobals();
  else if (state.tab === "preview") paintPreview();
  else if (state.tab === "formula") paintFormula(tabBody, host);
  else if (state.tab === "form") paintForm(tabBody, host);
  else if (state.tab === "animate") paintAnimate(tabBody, host);
  else if (state.tab === "color") paintColor(tabBody, host);
  else if (state.tab === "events") paintEvents(tabBody, host);
  else if (state.tab === "source") paintSource(tabBody, host);
  else paintItem();
}

function paintItem() {
  const mod = moduleAt(state.preset.preset_root, state.selection);
  const node = selectedNode();
  if (!mod || !node) return;
  if (node.kind === "root") {
    const info = state.preset.preset_info ?? (state.preset.preset_info = {});
    tabBody.append(
      field("Title", textInput(String(info.title ?? ""), (value) => (info.title = value))),
      field("Author", textInput(String(info.author ?? ""), (value) => (info.author = value))),
      grid(
        field("Width", numberInput(Number(info.width ?? 1080), (value) => (info.width = value))),
        field("Height", numberInput(Number(info.height ?? 1920), (value) => (info.height = value))),
      ),
    );
    note("The root is the screen. Add text and shapes from the layer panel.");
    return;
  }
  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    action("Duplicate", duplicate),
    action("Delete", removeSelected, true),
    action("Back", () => moveZ(-1)),
    action("Forward", () => moveZ(1)),
  );
  tabBody.append(actions);
  tabBody.append(field("Name", textInput(String(mod.internal_title ?? ""), (value) => (mod.internal_title = value))));
  const parent = parentNode(node.path);
  if (parent) {
    tabBody.append(
      grid(
        field("X", numberInput(Math.round(node.x - parent.x), (value) => setAxis(mod, parent, value, node.y - parent.y, node))),
        field("Y", numberInput(Math.round(node.y - parent.y), (value) => setAxis(mod, parent, node.x - parent.x, value, node))),
      ),
    );
  }
  tabBody.append(field("Anchor", anchorSelect(mod)));
  if (mod.internal_type === "TextModule") {
    tabBody.append(field("Text", areaInput(String(mod.text_expression ?? ""), (value) => (mod.text_expression = value))));
    const resolved = document.createElement("div");
    resolved.id = "resolved";
    resolved.className = "resolved";
    resolved.textContent = node.text;
    tabBody.append(field("Shows as", resolved));
    tabBody.append(field("Font size", numberInput(node.fontSize, (value) => writeTextSize(mod, value))));
  }
  if (mod.internal_type === "ShapeModule" || mod.internal_type === "ProgressModule") {
    tabBody.append(
      grid(
        field("Width", numberInput(Math.round(node.w), (value) => setLiteral(mod, "shape_width", value))),
        field("Height", numberInput(Math.round(node.h), (value) => setLiteral(mod, "shape_height", value))),
      ),
    );
    if (mod.internal_type === "ShapeModule") {
      tabBody.append(field("Shape", shapeSelect(mod)));
      tabBody.append(field("Corners", numberInput(Number(mod.shape_corners ?? 0), (value) => setLiteral(mod, "shape_corners", value))));
    }
  }
  tabBody.append(field("Color", colorControl(mod)));
  const formula = formulaSummary(mod);
  if (formula) note(formula);
  const event = mod.internal_events?.[0];
  if (event) note(`Touch: ${String(event.action ?? "action")}${event.music_action ? " · " + String(event.music_action) : ""}`);
}

function paintGlobals() {
  const list = state.preset.preset_root.globals_list ?? (state.preset.preset_root.globals_list = {});
  const add = document.createElement("div");
  add.className = "actions";
  for (const type of ["COLOR", "NUMBER", "TEXT", "SWITCH"]) {
    add.append(action(type[0] + type.slice(1).toLowerCase(), () => addGlobal(type)));
  }
  tabBody.append(add);
  const entries = Object.entries(list);
  if (!entries.length) note("Globals are the knobs of a preset: colors, numbers, and text shared by many items.");
  for (const [key, global] of entries) tabBody.append(globalCard(key, global, list));
}

function globalCard(key: string, global: GlobalDef, list: Record<string, GlobalDef>): HTMLElement {
  const card = document.createElement("div");
  card.className = "global";
  const head = document.createElement("header");
  const title = document.createElement("b");
  title.textContent = String(global.title || key);
  const meta = document.createElement("span");
  meta.className = "hint";
  meta.textContent = `${global.type || "TEXT"} · ${key}`;
  const remove = action("Remove", () => {
    pushHistory();
    delete list[key];
    renderAll(true);
  }, true);
  head.append(title, meta, remove);
  card.append(head);
  card.append(field("Title", textInput(String(global.title ?? ""), (value) => (global.title = value))));
  if (global.description) note(String(global.description), card);
  const type = String(global.type || "TEXT").toUpperCase();
  if (type === "COLOR") card.append(field("Color", colorValueInput(String(global.value ?? "#FFFFFFFF"), (value) => (global.value = value))));
  else if (type === "NUMBER" || type === "SWITCH") {
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(global.min ?? (type === "SWITCH" ? 0 : 0));
    input.max = String(global.max ?? (type === "SWITCH" ? 1 : 100));
    input.step = type === "SWITCH" ? "1" : "1";
    input.value = String(global.value ?? 0);
    const readout = document.createElement("span");
    readout.className = "hint";
    readout.textContent = input.value;
    input.addEventListener("pointerdown", () => pushHistory());
    input.addEventListener("input", () => {
      global.value = Number(input.value);
      readout.textContent = input.value;
      state.dirty = true;
      relayout();
      paintStage();
      paintChrome();
    });
    const row = document.createElement("div");
    row.className = "field";
    row.append(input, readout);
    card.append(row);
  } else if (type === "LIST" && global.entries) {
    const select = document.createElement("select");
    for (const part of String(global.entries).split(",")) {
      const [value, label] = part.split("##");
      const option = document.createElement("option");
      option.value = value ?? "";
      option.textContent = label || value || "";
      select.append(option);
    }
    select.value = String(global.value ?? "");
    select.addEventListener("change", () => {
      pushHistory();
      global.value = select.value;
      renderAll(false);
    });
    card.append(field("Value", select));
  } else {
    card.append(field("Value", areaInput(String(global.value ?? ""), (value) => (global.value = value))));
  }
  return card;
}

function paintPreview() {
  const device = state.device;
  note("These values are not saved. They drive formulas so the phone matches a moment in the day.");
  const real = document.createElement("input");
  real.type = "checkbox";
  real.checked = device.useRealTime;
  real.addEventListener("change", () => {
    device.useRealTime = real.checked;
    renderAll(false);
  });
  const row = document.createElement("label");
  row.className = "field row";
  row.append(real, document.createTextNode(" Use the real clock"));
  tabBody.append(row);
  tabBody.append(slider("Hour", 0, 23, device.hour, (value) => {
    device.useRealTime = false;
    device.hour = value;
    const box = tabBody.querySelector<HTMLInputElement>("input[type=checkbox]");
    if (box) box.checked = false;
  }));
  const info = state.preset.preset_info ?? (state.preset.preset_info = {});
  tabBody.append(
    grid(
      field("Screen width", numberInput(Number(info.width ?? 1080), (value) => (info.width = value))),
      field("Screen height", numberInput(Number(info.height ?? 1920), (value) => (info.height = value))),
    ),
  );
  tabBody.append(slider("Battery", 0, 100, device.battery, (value) => (device.battery = value)));
  tabBody.append(check("Charging", device.charging, (value) => (device.charging = value)));
  tabBody.append(check("Fast charge", device.fast, (value) => (device.fast = value)));
  tabBody.append(slider("Temperature", -10, 45, device.temp, (value) => (device.temp = value)));
  const condition = document.createElement("select");
  for (const name of ["Clear", "Cloudy", "Rain", "Snow", "Storm", "Fog"]) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    condition.append(option);
  }
  condition.value = device.condition;
  condition.addEventListener("change", () => {
    device.condition = condition.value;
    renderAll(false);
  });
  tabBody.append(field("Sky", condition));
  tabBody.append(field("Artist", textInput(device.artist, (value) => (device.artist = value), false)));
  tabBody.append(field("Track", textInput(device.title, (value) => (device.title = value), false)));
  tabBody.append(check("Music playing", device.playing, (value) => (device.playing = value)));
  tabBody.append(field("Wi-Fi", textInput(device.ssid, (value) => (device.ssid = value), false)));
  tabBody.append(slider("Notifications", 0, 12, device.notifications, (value) => (device.notifications = value)));
  tabBody.append(slider("Brightness", 0, 255, device.brightness, (value) => (device.brightness = value)));
}

function addGlobal(type: string) {
  pushHistory();
  const list = state.preset.preset_root.globals_list ?? (state.preset.preset_root.globals_list = {});
  let n = 1;
  while (list[`g${n}`]) n++;
  const key = `g${n}`;
  list[key] = {
    index: Object.keys(list).length + 1,
    type,
    title: type === "COLOR" ? "Color" : type === "NUMBER" ? "Number" : type === "SWITCH" ? "Switch" : "Text",
    value: type === "COLOR" ? "#FFFFFFFF" : type === "NUMBER" ? 50 : type === "SWITCH" ? 1 : "Text",
    ...(type === "NUMBER" ? { min: 0, max: 100 } : {}),
  };
  state.status = `Added global ${key}`;
  renderAll(true);
}

function colorControl(mod: KModule): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "grid2";
  const globals = colorGlobals();
  const linked = Number(mod.internal_toggles?.paint_color) === 100 ? mod.internal_globals?.paint_color ?? "" : "";
  if (globals.length) {
    const select = document.createElement("select");
    const custom = document.createElement("option");
    custom.value = "";
    custom.textContent = "Custom";
    select.append(custom);
    for (const [key, global] of globals) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = String(global.title || key);
      select.append(option);
    }
    select.value = linked;
    select.addEventListener("change", () => {
      pushHistory();
      if (!select.value) setLiteral(mod, "paint_color", "#FFFFFFFF");
      else {
        mod.internal_globals = { ...(mod.internal_globals ?? {}), paint_color: select.value };
        mod.internal_toggles = { ...(mod.internal_toggles ?? {}), paint_color: 100 };
        if (mod.internal_formulas?.paint_color) delete mod.internal_formulas.paint_color;
      }
      renderAll(true);
    });
    wrap.append(select);
  }
  if (!linked) {
    const current = String(mod.paint_color ?? "#FFFFFFFF");
    wrap.append(colorValueInput(current, (value) => setLiteral(mod, "paint_color", value)));
  }
  return wrap;
}

function colorValueInput(value: string, apply: (value: string) => void): HTMLElement {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "8px";
  const picker = document.createElement("input");
  picker.type = "color";
  picker.value = toRgb(value);
  const hex = textInput(value, apply);
  picker.addEventListener("input", () => {
    const next = "#FF" + picker.value.slice(1).toUpperCase();
    hex.value = next;
    apply(next);
    state.dirty = true;
    relayout();
    paintStage();
    paintLayers();
    paintChrome();
  });
  row.append(picker, hex);
  return row;
}

function anchorSelect(mod: KModule): HTMLSelectElement {
  const select = document.createElement("select");
  for (const anchor of ["TOPLEFT", "TOP", "TOPRIGHT", "CENTERLEFT", "CENTER", "CENTERRIGHT", "BOTTOMLEFT", "BOTTOM", "BOTTOMRIGHT"]) {
    const option = document.createElement("option");
    option.value = anchor;
    option.textContent = anchor.toLowerCase();
    select.append(option);
  }
  select.value = String(mod.position_anchor || "CENTER").toUpperCase();
  select.addEventListener("change", () => {
    const node = selectedNode();
    const parent = node ? parentNode(node.path) : undefined;
    pushHistory();
    if (node && parent) {
      const localX = node.x - parent.x;
      const localY = node.y - parent.y;
      mod.position_anchor = select.value;
      writePosition(mod, parent, localX, localY, node.w, node.h, 1);
    } else mod.position_anchor = select.value;
    renderAll(true);
  });
  return select;
}

function shapeSelect(mod: KModule): HTMLSelectElement {
  const select = document.createElement("select");
  for (const shape of ["RECT", "CIRCLE", "OVAL", "TRIANGLE"]) {
    const option = document.createElement("option");
    option.value = shape;
    option.textContent = shape.toLowerCase();
    select.append(option);
  }
  select.value = String(mod.shape_type || "RECT").toUpperCase() === "TRI" ? "TRIANGLE" : String(mod.shape_type || "RECT").toUpperCase();
  select.addEventListener("change", () => {
    pushHistory();
    setLiteral(mod, "shape_type", select.value);
    renderAll(true);
  });
  return select;
}

function setAxis(mod: KModule, parent: SceneNode, x: number, y: number, node: SceneNode) {
  writePosition(mod, parent, x, y, node.w, node.h, 1);
}

function formulaSummary(mod: KModule): string {
  const formulas = mod.internal_formulas ?? {};
  const keys = Object.keys(formulas);
  if (!keys.length) return "";
  return keys.map((key) => `${key}: ${formulas[key]}`).join("\n");
}

function colorGlobals(): [string, GlobalDef][] {
  return Object.entries(state.preset.preset_root.globals_list ?? {}).filter(([, global]) => String(global.type).toUpperCase() === "COLOR");
}

function textInput(value: string, apply: (value: string) => void, history = true): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  bindField(input, () => apply(input.value), history);
  return input;
}

function areaInput(value: string, apply: (value: string) => void): HTMLTextAreaElement {
  const input = document.createElement("textarea");
  input.value = value;
  bindField(input, () => apply(input.value), true);
  return input;
}

function numberInput(value: number, apply: (value: number) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(Math.round(value * 100) / 100);
  bindField(input, () => apply(Number(input.value)), true);
  return input;
}

function bindField(input: HTMLInputElement | HTMLTextAreaElement, apply: () => void, history: boolean) {
  input.addEventListener("focus", () => {
    if (history && !state.fieldUndo) {
      pushHistory();
      state.fieldUndo = true;
    }
  });
  input.addEventListener("blur", () => {
    state.fieldUndo = false;
  });
  input.addEventListener("input", () => {
    apply();
    state.dirty = true;
    relayout();
    paintStage();
    paintLayers();
    paintChrome();
    const resolved = document.querySelector("#resolved");
    const node = selectedNode();
    if (resolved && node?.kind === "text") resolved.textContent = node.text;
  });
}

function slider(label: string, min: number, max: number, value: number, apply: (value: number) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const caption = document.createElement("span");
  caption.textContent = `${label}: ${value}`;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.addEventListener("input", () => {
    apply(Number(input.value));
    caption.textContent = `${label}: ${input.value}`;
    relayout();
    paintStage();
  });
  wrap.append(caption, input);
  return wrap;
}

function check(label: string, value: boolean, apply: (value: boolean) => void): HTMLElement {
  const row = document.createElement("label");
  row.className = "field row";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => {
    apply(input.checked);
    relayout();
    paintStage();
  });
  row.append(input, document.createTextNode(" " + label));
  return row;
}

function field(label: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "field";
  const span = document.createElement("span");
  span.textContent = label;
  wrap.append(span, control);
  return wrap;
}

function grid(...nodes: HTMLElement[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "grid2";
  wrap.append(...nodes);
  return wrap;
}

function note(text: string, parent: HTMLElement = tabBody) {
  const el = document.createElement("p");
  el.className = "hint";
  el.style.whiteSpace = "pre-wrap";
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

function syncCoordinates() {
  const node = selectedNode();
  const parent = node ? parentNode(node.path) : undefined;
  const inputs = tabBody.querySelectorAll<HTMLInputElement>("input[type=number]");
  if (!node || !parent || inputs.length < 2) return;
  if (document.activeElement !== inputs[0]) inputs[0]!.value = String(Math.round(node.x - parent.x));
  if (document.activeElement !== inputs[1]) inputs[1]!.value = String(Math.round(node.y - parent.y));
}

function selectedNode(): SceneNode | undefined {
  return scene.find((node) => samePath(node.path, state.selection));
}

function parentNode(path: number[]): SceneNode | undefined {
  return scene.find((node) => samePath(node.path, path.slice(0, -1)));
}

function samePath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((part, index) => part === b[index]);
}

function point(event: PointerEvent): { x: number; y: number } {
  const rect = stage.getBoundingClientRect();
  const { w, h } = presetSize(state.preset);
  return {
    x: ((event.clientX - rect.left) / rect.width) * w,
    y: ((event.clientY - rect.top) / rect.height) * h,
  };
}

function snapTo(value: number, snap: number): number {
  if (snap <= 1) return Math.round(value);
  return Math.round(value / snap) * snap;
}

function countModules(mod: KModule): number {
  return 1 + (mod.viewgroup_items?.reduce((sum, child) => sum + countModules(child), 0) ?? 0);
}

function toRgb(value: string): string {
  const hex = value.replace("#", "");
  const rgb = hex.length === 8 ? hex.slice(2) : hex.slice(0, 6);
  return ("#" + rgb.padEnd(6, "0")).slice(0, 7);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

function currentCtx() {
  state.device.now = deviceNow(state.device);
  const { w, h } = presetSize(state.preset);
  return makeCtx({
    device: state.device,
    presetW: w,
    presetH: h,
    globalChain: [state.preset.preset_root.globals_list ?? {}],
  });
}

function animEnv(): AnimEnv {
  const ctx = currentCtx();
  return {
    timeSec: performance.now() / 1000,
    scroll: state.scroll,
    unlocked: state.unlocked,
    unlockAge: state.unlocked ? (performance.now() - state.unlockAt) / 1000 : 0,
    formula: (source) => {
      const value = evalLoose(source, ctx);
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    },
    flag: (name) => {
      const value = globalValue(ctx, name, 0);
      if (typeof value === "number") return value !== 0;
      const text = String(value ?? "").trim().toLowerCase();
      return text !== "" && text !== "0" && text !== "false" && text !== "off";
    },
  };
}

function paintMotion(el: HTMLElement, node: SceneNode, env: AnimEnv) {
  let frame: AnimFrame = { ...REST_FRAME };
  if (!(state.dragging && samePath(node.path, state.selection))) {
    for (let depth = 1; depth <= node.path.length; depth++) {
      const ancestor = scene.find((item) => samePath(item.path, node.path.slice(0, depth)));
      if (ancestor) frame = combineFrames(frame, animationFrame(ancestor.mod.internal_animations, env));
    }
  }
  if (isRest(frame)) {
    el.style.opacity = "";
    el.style.transform = "";
    return;
  }
  el.style.opacity = String(frame.opacity);
  el.style.transform = frameTransform(frame);
  el.style.transformOrigin = "center";
}

function previewLive(touch = true) {
  if (touch) state.dirty = true;
  relayout();
  paintStage();
  paintLayers();
  paintChrome();
}

function readProp(mod: KModule | null, key: string): { mode: "value" | "formula" | "global"; raw: string; value: string } {
  if (!mod) return { mode: "value", raw: "", value: "" };
  const ctx = currentCtx();
  const toggle = mod.internal_toggles?.[key];
  if (Number(toggle) === 100 && mod.internal_globals?.[key]) {
    const raw = mod.internal_globals[key]!;
    return { mode: "global", raw, value: stringify(globalValue(ctx, raw, "")) };
  }
  const formula = mod.internal_formulas?.[key];
  if (typeof formula === "string" && (toggle == null || Number(toggle) === 10)) {
    return { mode: "formula", raw: formula, value: stringify(evalLoose(formula, ctx)) };
  }
  if (key === "text_expression") {
    const raw = String(mod.text_expression ?? "");
    return { mode: "value", raw, value: raw.includes("$") ? stringify(evalLoose(raw, ctx)) : raw };
  }
  const raw = mod[key] == null ? "" : String(mod[key]);
  return { mode: "value", raw, value: raw };
}

function studio(): StudioHost {
  const mod = moduleAt(state.preset.preset_root, state.selection);
  return {
    preset: state.preset,
    module: mod,
    device: state.device,
    scroll: state.scroll,
    setScroll: (value) => {
      state.scroll = value;
      previewLive(false);
    },
    unlocked: state.unlocked,
    setUnlocked: (value) => {
      state.unlocked = value;
      if (value) state.unlockAt = performance.now();
      previewLive(false);
    },
    pushHistory,
    refresh: () => renderAll(true),
    preview: () => previewLive(true),
    status: (message) => {
      state.status = message;
      paintChrome();
    },
    insertTool: (tool: Tool) => insertModule(structuredClone(tool.module), tool.globals),
    evalSource: (source) => {
      try {
        return stringify(evalLoose(source, currentCtx()));
      } catch {
        return "";
      }
    },
    animEnv,
    replaceModule: (next) => {
      const loc = parentAt(state.preset.preset_root, state.selection);
      if (loc?.parent.viewgroup_items) loc.parent.viewgroup_items[loc.index] = next;
      else if (state.selection.length === 0) state.preset.preset_root = next;
      else return;
      state.status = "Applied source";
      renderAll(true);
    },
    replacePreset: (next) => {
      if (!next?.preset_root) {
        state.status = "Preset source needs a preset_root.";
        paintChrome();
        return;
      }
      state.preset = next;
      state.selection = [];
      state.status = "Applied preset source";
      renderAll(true);
    },
    readProp: (key) => readProp(mod, key),
  };
}

function tickMotion() {
  const env = animEnv();
  for (const node of scene) {
    const el = stage.querySelector<HTMLElement>(`[data-path="${pathKey(node.path)}"]`);
    if (el) paintMotion(el, node, env);
  }
  requestAnimationFrame(tickMotion);
}

renderAll(true);
requestAnimationFrame(tickMotion);
