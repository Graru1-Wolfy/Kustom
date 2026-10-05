import type { Device, GlobalDef } from "../types";

export type KEvent = {
  type?: string;
  action?: string;
  switch?: string;
  switch_list?: string;
  music_action?: string;
  url?: string;
  intent?: string;
  value?: string;
};

const TRACKS = ["Glass Tide", "North Window", "Low Lamp", "Harbour Road"];

export function applyEvent(event: KEvent, device: Device, globals: Record<string, GlobalDef>): string {
  const action = String(event.action || "").toUpperCase();
  if (action === "SWITCH_GLOBAL" || action === "TOGGLE_GLOBAL") return switchGlobal(event, globals);
  if (action === "SET_GLOBAL") return setGlobal(event, globals);
  if (action === "MUSIC") return music(event, device);
  if (action === "OPEN_URL" || action === "OPEN_LINK") return `Link ${event.url || ""}`.trim();
  if (action === "LAUNCH_APP") return `Would launch ${intentLabel(event.intent)}`;
  return action ? `Event ${action}` : "Tap";
}

export function describeEvent(event: KEvent): string {
  const gesture = String(event.type || "SINGLE_TAP").replaceAll("_", " ").toLowerCase();
  const action = String(event.action || "action");
  if (action === "SWITCH_GLOBAL" || action === "TOGGLE_GLOBAL") {
    return `${gesture} toggles ${event.switch || "a global"}${event.switch_list ? " → " + event.switch_list : ""}`;
  }
  if (action === "MUSIC") return `${gesture} · music ${String(event.music_action || "TOGGLE").toLowerCase()}`;
  if (action === "LAUNCH_APP") return `${gesture} launches ${intentLabel(event.intent)}`;
  if (action === "OPEN_URL" || action === "OPEN_LINK") return `${gesture} opens ${event.url || "a link"}`;
  return `${gesture} · ${action}`;
}

function switchGlobal(event: KEvent, globals: Record<string, GlobalDef>): string {
  const key = event.switch || "switch";
  const global = ensure(globals, key, event.switch_list ? "LIST" : "SWITCH");
  if (event.switch_list) {
    global.value = event.switch_list;
    return `Set ${global.title || key} to ${event.switch_list}`;
  }
  const on = !isOn(global.value);
  global.value = on ? 1 : 0;
  return `${global.title || key} is ${on ? "on" : "off"}`;
}

function setGlobal(event: KEvent, globals: Record<string, GlobalDef>): string {
  const key = event.switch || "value";
  const global = ensure(globals, key, "TEXT");
  global.value = event.value ?? event.switch_list ?? "";
  return `Set ${global.title || key}`;
}

function music(event: KEvent, device: Device): string {
  const action = String(event.music_action || "TOGGLE").toUpperCase();
  if (action === "TOGGLE") device.playing = !device.playing;
  else if (action === "PLAY") device.playing = true;
  else if (action === "STOP" || action === "PAUSE") device.playing = false;
  else if (action === "NEXT") device.title = stepTrack(device.title, 1);
  else if (action === "PREV" || action === "PREVIOUS") device.title = stepTrack(device.title, -1);
  else if (action === "OPEN_APP") return "Would open the music app";
  return device.playing ? `Playing ${device.title}` : "Music stopped";
}

function stepTrack(title: string, dir: number): string {
  const index = Math.max(0, TRACKS.indexOf(title));
  return TRACKS[(index + dir + TRACKS.length) % TRACKS.length]!;
}

function ensure(globals: Record<string, GlobalDef>, key: string, type: string): GlobalDef {
  const found = globals[key];
  if (found) return found;
  const created: GlobalDef = {
    index: Object.keys(globals).length + 1,
    type,
    title: key,
    value: type === "SWITCH" ? 0 : "",
  };
  globals[key] = created;
  return created;
}

function isOn(value: unknown): boolean {
  if (typeof value === "number") return value !== 0;
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return text !== "" && text !== "0" && text !== "false" && text !== "off";
}

function intentLabel(intent: string | undefined): string {
  const label = /label=([^;]+)/.exec(intent || "")?.[1];
  if (!label) return "an app";
  try {
    return decodeURIComponent(label);
  } catch {
    return label;
  }
}
