import { bbcodeToHtml, stripBbcode } from "./bbcode";
import { rgbaCss } from "./color";
import { expandText, globalValue, isTruthy, makeCtx, num, stringify, type EvalCtx } from "./formula/eval";
import { fieldPresent, readField, readNumber } from "./props";
import type { KModule, Preset, SceneNode } from "./types";
import type { Device } from "./types";

export type MeasureFn = (text: string, size: number, family: string) => { w: number; h: number };

export type LayoutOptions = {
  measure: MeasureFn;
  fontFamily?: (spec: string) => string;
  editorHidden?: Set<string>;
};

const GROUPS = new Set(["RootLayerModule", "OverlapLayerModule", "StackLayerModule", "KomponentModule"]);

export function isContainer(mod: KModule): boolean {
  return GROUPS.has(mod.internal_type ?? "") || Array.isArray(mod.viewgroup_items);
}

export function anchoredOrigin(
  anchor: string,
  parentW: number,
  parentH: number,
  w: number,
  h: number,
  padL: number,
  padT: number,
  padR: number,
  padB: number,
  offX: number,
  offY: number,
  present: { l?: boolean; t?: boolean; r?: boolean; b?: boolean } = {},
): { x: number; y: number } {
  const a = (anchor || "CENTER").toUpperCase();
  const left = a.includes("LEFT");
  const right = a.includes("RIGHT");
  const top = a.includes("TOP");
  const bottom = a.includes("BOTTOM");
  let x: number;
  if (left) x = padL;
  else if (right) x = parentW - w - padR;
  else if (present.l && !present.r) x = padL;
  else if (present.r && !present.l) x = parentW - w - padR;
  else x = (parentW - w) / 2 + padL - padR;
  let y: number;
  if (top) y = padT;
  else if (bottom) y = parentH - h - padB;
  else if (present.t && !present.b) y = padT;
  else if (present.b && !present.t) y = parentH - h - padB;
  else y = (parentH - h) / 2 + padT - padB;
  return { x: x + offX, y: y + offY };
}

export function positionWrites(
  anchor: string,
  parentW: number,
  parentH: number,
  w: number,
  h: number,
  localX: number,
  localY: number,
  padL: number,
  padT: number,
  padR: number,
  padB: number,
  offX: number,
  offY: number,
): { key: string; value: number }[] {
  const a = (anchor || "CENTER").toUpperCase();
  const left = a.includes("LEFT");
  const right = !left && a.includes("RIGHT");
  const top = a.includes("TOP");
  const bottom = !top && a.includes("BOTTOM");
  const round = (value: number) => Math.round(value * 100) / 100;
  const writes: { key: string; value: number }[] = [];
  if (left) writes.push({ key: "position_padding_left", value: round(localX - offX) });
  else if (right) writes.push({ key: "position_padding_right", value: round(parentW - w - localX + offX) });
  else writes.push({ key: "position_offset_x", value: round(localX - (parentW - w) / 2 - padL + padR) });
  if (top) writes.push({ key: "position_padding_top", value: round(localY - offY) });
  else if (bottom) writes.push({ key: "position_padding_bottom", value: round(parentH - h - localY + offY) });
  else writes.push({ key: "position_offset_y", value: round(localY - (parentH - h) / 2 - padT + padB) });
  return writes;
}

export function layoutPreset(preset: Preset, device: Device, options: LayoutOptions): SceneNode[] {
  const root = preset.preset_root;
  const ctx = makeCtx({
    device,
    presetW: Number(preset.preset_info?.width) || 1080,
    presetH: Number(preset.preset_info?.height) || 1920,
    globalChain: root.globals_list ? [root.globals_list] : [],
  });
  const nodes: SceneNode[] = [];
  emit(root, [], 0, 0, ctx.presetW, ctx.presetH, ctx, nodes, options);
  return nodes;
}

export function pathKey(path: number[]): string {
  return path.join(".");
}

function emit(
  mod: KModule,
  path: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  ctx: EvalCtx,
  out: SceneNode[],
  options: LayoutOptions,
) {
  const pushed = mod.internal_type !== "RootLayerModule" && Boolean(mod.globals_list);
  if (pushed && mod.globals_list) ctx.globalChain.push(mod.globals_list);
  const start = out.length;
  try {
    const node = makeNode(mod, path, x, y, w, h, ctx, options);
    out.push(node);
    if (!isContainer(mod)) return;
    const kids = mod.viewgroup_items ?? [];
    if ((mod.internal_type ?? "") === "StackLayerModule") placeStack(mod, kids, path, x, y, w, h, ctx, out, options);
    else placeFree(kids, path, x, y, w, h, ctx, out, options);
    const scale = scaleOf(mod, ctx);
    if (scale !== 1) scaleFrom(out, start, x, y, scale);
  } finally {
    if (pushed) ctx.globalChain.pop();
  }
}

function placeFree(
  kids: KModule[],
  parentPath: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  ctx: EvalCtx,
  out: SceneNode[],
  options: LayoutOptions,
) {
  kids.forEach((kid, index) => {
    withIndex(ctx, index, kids.length, () => {
      const vis = visibility(kid, ctx);
      if (vis === "remove") {
        out.push(makeNode(kid, parentPath.concat(index), x, y, 0, 0, ctx, options, true));
        return;
      }
      const size = measure(kid, ctx, options);
      const anchor = String(readField(kid, "position_anchor", ctx) || "CENTER");
      const local = anchoredOrigin(
        anchor,
        w,
        h,
        size.w,
        size.h,
        readNumber(kid, "position_padding_left", ctx),
        readNumber(kid, "position_padding_top", ctx),
        readNumber(kid, "position_padding_right", ctx),
        readNumber(kid, "position_padding_bottom", ctx),
        readNumber(kid, "position_offset_x", ctx),
        readNumber(kid, "position_offset_y", ctx),
        {
          l: fieldPresent(kid, "position_padding_left"),
          t: fieldPresent(kid, "position_padding_top"),
          r: fieldPresent(kid, "position_padding_right"),
          b: fieldPresent(kid, "position_padding_bottom"),
        },
      );
      const at = out.length;
      emit(kid, parentPath.concat(index), x + local.x, y + local.y, size.w, size.h, ctx, out, options);
      if (vis === "hide") hideSubtree(out, at);
    });
  });
}

function placeStack(
  mod: KModule,
  kids: KModule[],
  parentPath: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  ctx: EvalCtx,
  out: SceneNode[],
  options: LayoutOptions,
) {
  const mode = String(readField(mod, "config_stacking", ctx) || "VERTICAL").toUpperCase();
  const horizontal = mode.includes("HORIZONTAL");
  const gap = readNumber(mod, "config_margin", ctx);
  let cursor = 0;
  kids.forEach((kid, index) => {
    withIndex(ctx, index, kids.length, () => {
      const vis = visibility(kid, ctx);
      if (vis === "remove") {
        out.push(makeNode(kid, parentPath.concat(index), x, y, 0, 0, ctx, options, true));
        return;
      }
      const size = measure(kid, ctx, options);
      const cross = alignCross(mode, horizontal, horizontal ? h : w, horizontal ? size.h : size.w);
      const lx = horizontal ? cursor : cross;
      const ly = horizontal ? cross : cursor;
      const at = out.length;
      emit(kid, parentPath.concat(index), x + lx, y + ly, size.w, size.h, ctx, out, options);
      if (vis === "hide") hideSubtree(out, at);
      cursor += (horizontal ? size.w : size.h) + gap;
    });
  });
}

function alignCross(mode: string, horizontal: boolean, crossSize: number, childCross: number): number {
  const end = horizontal ? mode.includes("BOTTOM") : mode.includes("RIGHT");
  const center = mode.includes("CENTER");
  if (end) return crossSize - childCross;
  if (center) return (crossSize - childCross) / 2;
  return 0;
}

function measure(mod: KModule, ctx: EvalCtx, options: LayoutOptions): { w: number; h: number } {
  const type = mod.internal_type ?? "";
  if (type === "RootLayerModule") return { w: ctx.presetW, h: ctx.presetH };
  if (type === "StackLayerModule") return measureStack(mod, ctx, options);
  if (type === "OverlapLayerModule" || type === "KomponentModule") return measureOverlap(mod, ctx, options);
  if (type === "TextModule") return measureText(mod, ctx, options);
  if (type === "ProgressModule") {
    const size = readNumber(mod, "style_size", ctx, 100);
    return { w: size, h: size };
  }
  if (type === "ShapeModule" || !mod.viewgroup_items) return measureShape(mod, ctx);
  return measureOverlap(mod, ctx, options);
}

function measureOverlap(mod: KModule, ctx: EvalCtx, options: LayoutOptions): { w: number; h: number } {
  const kids = mod.viewgroup_items ?? [];
  let w = 0;
  let h = 0;
  kids.forEach((kid, index) => {
    withIndex(ctx, index, kids.length, () => {
      if (visibility(kid, ctx) === "remove") return;
      const size = measure(kid, ctx, options);
      w = Math.max(w, size.w);
      h = Math.max(h, size.h);
    });
  });
  return { w: w || 1, h: h || 1 };
}

function measureStack(mod: KModule, ctx: EvalCtx, options: LayoutOptions): { w: number; h: number } {
  const mode = String(readField(mod, "config_stacking", ctx) || "VERTICAL").toUpperCase();
  const horizontal = mode.includes("HORIZONTAL");
  const gap = readNumber(mod, "config_margin", ctx);
  let main = 0;
  let cross = 0;
  let count = 0;
  (mod.viewgroup_items ?? []).forEach((kid, index) => {
    withIndex(ctx, index, mod.viewgroup_items?.length ?? 0, () => {
      if (visibility(kid, ctx) === "remove") return;
      const size = measure(kid, ctx, options);
      main += horizontal ? size.w : size.h;
      cross = Math.max(cross, horizontal ? size.h : size.w);
      count++;
    });
  });
  if (count > 1) main += gap * (count - 1);
  return horizontal ? { w: main || 1, h: cross || 1 } : { w: cross || 1, h: main || 1 };
}

function measureText(mod: KModule, ctx: EvalCtx, options: LayoutOptions): { w: number; h: number } {
  const text = expandText(String(mod.text_expression ?? ""), ctx);
  const size = Math.max(1, readNumber(mod, "text_size", ctx, 20));
  const family = (options.fontFamily ?? defaultFont)(String(readField(mod, "text_family", ctx) ?? ""));
  const box = options.measure(stripBbcode(text), size, family);
  return { w: Math.max(1, box.w), h: Math.max(size, box.h) };
}

function measureShape(mod: KModule, ctx: EvalCtx): { w: number; h: number } {
  const shape = String(readField(mod, "shape_type", ctx) || "RECT").toUpperCase();
  const hasW = fieldPresent(mod, "shape_width");
  const hasH = fieldPresent(mod, "shape_height");
  let w = hasW ? num(readField(mod, "shape_width", ctx)) : Number.NaN;
  let h = hasH ? num(readField(mod, "shape_height", ctx)) : Number.NaN;
  const circular = shape === "CIRCLE" || shape === "OVAL" || shape === "DISK";
  if (circular) {
    if (!Number.isFinite(w)) w = Number.isFinite(h) ? h : 100;
    if (!Number.isFinite(h)) h = w;
  } else {
    if (!Number.isFinite(w)) w = 100;
    if (!Number.isFinite(h)) h = 100;
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function makeNode(
  mod: KModule,
  path: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  ctx: EvalCtx,
  options: LayoutOptions,
  removed = false,
): SceneNode {
  const type = mod.internal_type ?? "Module";
  const kind = kindOf(type);
  const editorHidden = options.editorHidden?.has(pathKey(path)) ?? false;
  const text = kind === "text" ? expandText(String(mod.text_expression ?? ""), ctx) : "";
  const fontSize = kind === "text" ? Math.max(1, readNumber(mod, "text_size", ctx, 20)) : 0;
  const fontFamily = kind === "text" ? (options.fontFamily ?? defaultFont)(String(readField(mod, "text_family", ctx) ?? "")) : "";
  const color = stringify(readField(mod, "paint_color", ctx) ?? "#FFFFFFFF");
  return {
    path,
    mod,
    x,
    y,
    w,
    h,
    kind,
    title: String(mod.internal_title || titleFor(type)),
    typeName: titleFor(type),
    hidden: editorHidden,
    removed,
    text,
    html:
      kind === "text"
        ? bbcodeToHtml(text, (name) => stringify(globalValue(ctx, name, name.startsWith("#") ? name : "#FFFFFFFF")))
        : "",
    shape: String(readField(mod, "shape_type", ctx) || (type === "ProgressModule" ? "CIRCLE" : "RECT")),
    css: kind === "shape" || type === "ProgressModule" ? paintCss(mod, ctx, w, h, color) : { color: rgbaCss(color || "#FFFFFFFF") },
    fontSize,
    fontFamily,
  };
}

function paintCss(mod: KModule, ctx: EvalCtx, w: number, h: number, color: string): Record<string, string> {
  const type = mod.internal_type ?? "";
  const shape = String(readField(mod, "shape_type", ctx) || "RECT").toUpperCase();
  const corners = readNumber(mod, "shape_corners", ctx);
  const stroke = readNumber(mod, "paint_stroke", ctx);
  const style = String(readField(mod, "paint_style", ctx) || "FILL").toUpperCase();
  const gradient = String(readField(mod, "fx_gradient", ctx) || "");
  const gradientColor = stringify(readField(mod, "fx_gradient_color", ctx) || "");
  const gradientOffset = readNumber(mod, "fx_gradient_offset", ctx, 100);
  const css: Record<string, string> = {};
  if (shape === "CIRCLE" || shape === "OVAL" || shape === "DISK" || type === "ProgressModule") css.borderRadius = "999px";
  else if (shape === "TRI" || shape === "TRIANGLE") css.clipPath = "polygon(50% 0, 100% 100%, 0 100%)";
  else css.borderRadius = `${corners}px`;

  if (type === "ProgressModule") {
    const percent = Math.max(0, Math.min(100, progressPercent(mod, ctx)));
    const thickness = readNumber(mod, "style_height", ctx, 8);
    const fg = rgbaCss(color || "#FFFFFFFF");
    const track = "rgba(255,255,255,0.16)";
    const look = String(readField(mod, "style_style", ctx) || "CIRCLE").toUpperCase();
    if (look.includes("CIRCLE") || look.includes("RING")) {
      const radius = Math.min(w, h) / 2;
      const inner = Math.max(0, ((radius - thickness) / radius) * 100);
      css.background = `conic-gradient(${fg} ${percent}%, ${track} 0)`;
      css.mask = `radial-gradient(circle, transparent ${inner}%, #000 ${inner + 0.4}%)`;
    } else {
      css.background = `linear-gradient(to right, ${fg} ${percent}%, ${track} ${percent}%)`;
      css.borderRadius = `${corners || h / 2}px`;
    }
    return css;
  }

  const fill = rgbaCss(color || "#FFFFFFFF");
  if (style === "STROKE" || (stroke > 0 && style !== "FILL")) {
    css.background = "transparent";
    css.boxShadow = `inset 0 0 0 ${Math.max(stroke, 1)}px ${fill}`;
    return css;
  }
  if (gradient && gradientColor) {
    const mode = gradient.toUpperCase();
    if (mode.includes("RADIAL")) css.background = `radial-gradient(circle, ${fill}, ${rgbaCss(gradientColor)} ${gradientOffset}%)`;
    else {
      const dir = mode.includes("HORIZ") ? "to right" : "to bottom";
      css.background = `linear-gradient(${dir}, ${fill}, ${rgbaCss(gradientColor)} ${gradientOffset}%)`;
    }
    return css;
  }
  css.background = fill;
  return css;
}

function progressPercent(mod: KModule, ctx: EvalCtx): number {
  const raw = readField(mod, "progress_progress", ctx);
  const token = String(raw ?? "").toUpperCase();
  const now = ctx.device.now;
  if (token === "MINS_5") return (((now.getMinutes() % 5) * 60 + now.getSeconds()) / 300) * 100;
  if (token === "SECS" || token === "SEC") return (now.getSeconds() / 60) * 100;
  if (token === "MINS" || token === "MIN") return (now.getMinutes() / 60) * 100;
  if (token === "HOURS" || token === "HOUR") return (now.getHours() / 24) * 100;
  if (token === "BATT" || token === "BATTERY" || token === "LEVEL") return ctx.device.battery;
  return num(raw);
}

function visibility(mod: KModule, ctx: EvalCtx): "show" | "hide" | "remove" {
  if (!fieldPresent(mod, "config_visible")) return "show";
  const value = readField(mod, "config_visible", ctx);
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "" || text === "ALWAYS" || text === "1" || text === "TRUE") return "show";
  if (text === "NEVER") return "hide";
  if (text === "REMOVE" || text === "GONE" || text === "0" || text === "FALSE") return "remove";
  return isTruthy(value) ? "show" : "remove";
}

function scaleOf(mod: KModule, ctx: EvalCtx): number {
  if (!fieldPresent(mod, "config_scale_value")) return 1;
  const value = num(readField(mod, "config_scale_value", ctx));
  return value > 0 ? value / 100 : 1;
}

function hideSubtree(nodes: SceneNode[], index: number) {
  const path = nodes[index]!.path;
  nodes[index]!.hidden = true;
  for (let i = index + 1; i < nodes.length; i++) {
    const candidate = nodes[i]!.path;
    if (candidate.length <= path.length || !path.every((part, n) => candidate[n] === part)) break;
    nodes[i]!.hidden = true;
  }
}

function scaleFrom(nodes: SceneNode[], start: number, originX: number, originY: number, scale: number) {
  for (let i = start; i < nodes.length; i++) {
    const node = nodes[i]!;
    node.x = originX + (node.x - originX) * scale;
    node.y = originY + (node.y - originY) * scale;
    node.w *= scale;
    node.h *= scale;
    node.fontSize *= scale;
  }
}

function withIndex<T>(ctx: EvalCtx, index: number, count: number, fn: () => T): T {
  ctx.indexStack.push(index);
  ctx.countStack.push(count);
  try {
    return fn();
  } finally {
    ctx.indexStack.pop();
    ctx.countStack.pop();
  }
}

function kindOf(type: string): SceneNode["kind"] {
  if (type === "RootLayerModule") return "root";
  if (type === "TextModule") return "text";
  if (type === "ShapeModule" || type === "ProgressModule") return "shape";
  if (GROUPS.has(type)) return "group";
  return "other";
}

function titleFor(type: string): string {
  switch (type) {
    case "RootLayerModule":
      return "Root";
    case "OverlapLayerModule":
      return "Overlap";
    case "StackLayerModule":
      return "Stack";
    case "KomponentModule":
      return "Komponent";
    case "TextModule":
      return "Text";
    case "ShapeModule":
      return "Shape";
    case "ProgressModule":
      return "Progress";
    case "BitmapModule":
      return "Image";
    default:
      return type.replace(/Module$/, "") || "Item";
  }
}

function defaultFont(spec: string): string {
  if (/mono|fixed|roboto.?mono|ubuntu.?mono/i.test(spec)) return "ui-monospace, monospace";
  return "Roboto, sans-serif";
}

export function presetSize(preset: Preset): { w: number; h: number } {
  return {
    w: Number(preset.preset_info?.width) || 1080,
    h: Number(preset.preset_info?.height) || 1920,
  };
}
