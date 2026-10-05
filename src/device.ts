import type { Device } from "./types";

export function defaultDevice(now = new Date()): Device {
  return {
    now,
    useRealTime: true,
    hour: now.getHours(),
    minute: now.getMinutes(),
    battery: 72,
    charging: false,
    fast: false,
    temp: 21,
    condition: "Clear",
    humidity: 48,
    wind: 12,
    unit: "C",
    artist: "The Harbour Band",
    title: "Glass Tide",
    playing: true,
    notifications: 0,
    brightness: 140,
    ssid: "Harbor",
    bluetooth: 2,
    location: "Lisbon",
    country: "PT",
    model: "Pixel 8",
    android: "14",
    launcher: "Nova Launcher",
    launcherPkg: "com.teslacoilsw.launcher",
    launcherVer: "8.0",
    darkMode: true,
    uptimeSec: 3 * 3600 + 12 * 60,
    memoryUsed: 5.1,
    memoryTotal: 8,
    storageUsed: 64,
    storageTotal: 128,
  };
}

export function deviceNow(device: Device): Date {
  if (device.useRealTime) return new Date();
  const date = new Date();
  date.setHours(device.hour, device.minute, 0, 0);
  return date;
}
