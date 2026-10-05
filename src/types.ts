export type GlobalDef = {
  index?: number;
  type?: string;
  title?: string;
  description?: string;
  value?: unknown;
  min?: number;
  max?: number;
  entries?: string;
  off_mode?: string;
  off_timer?: number;
  toggles?: number;
  key?: string;
  [key: string]: unknown;
};

export type KModule = {
  internal_type?: string;
  internal_title?: string;
  viewgroup_items?: KModule[];
  globals_list?: Record<string, GlobalDef>;
  internal_formulas?: Record<string, string>;
  internal_globals?: Record<string, string>;
  internal_toggles?: Record<string, number>;
  internal_events?: Record<string, unknown>[];
  [key: string]: unknown;
};

export type PresetInfo = {
  version?: number;
  title?: string;
  description?: string;
  author?: string;
  email?: string;
  width?: number;
  height?: number;
  features?: string;
  release?: number;
  locked?: boolean;
  pflags?: number;
  [key: string]: unknown;
};

export type Preset = {
  preset_info?: PresetInfo;
  preset_root: KModule;
  [key: string]: unknown;
};

export type Device = {
  now: Date;
  useRealTime: boolean;
  hour: number;
  minute: number;
  battery: number;
  charging: boolean;
  fast: boolean;
  temp: number;
  condition: string;
  humidity: number;
  wind: number;
  unit: "C" | "F";
  artist: string;
  title: string;
  playing: boolean;
  notifications: number;
  brightness: number;
  ssid: string;
  bluetooth: number;
  location: string;
  country: string;
  model: string;
  android: string;
  launcher: string;
  launcherPkg: string;
  launcherVer: string;
  darkMode: boolean;
  uptimeSec: number;
  memoryUsed: number;
  memoryTotal: number;
  storageUsed: number;
  storageTotal: number;
};

export type SceneNode = {
  path: number[];
  mod: KModule;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "root" | "group" | "shape" | "text" | "other";
  title: string;
  typeName: string;
  hidden: boolean;
  removed: boolean;
  text: string;
  html: string;
  shape: string;
  css: Record<string, string>;
  fontSize: number;
  fontFamily: string;
};
