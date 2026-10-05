import assert from "node:assert/strict";
import test from "node:test";
import { animationFrame, type AnimEnv } from "./animate";
import { applyEvent } from "./events";
import type { Device, GlobalDef } from "../types";

function env(patch: Partial<AnimEnv> = {}): AnimEnv {
  return {
    timeSec: 0,
    scroll: 0,
    unlocked: false,
    unlockAge: 0,
    formula: () => 0,
    flag: () => false,
    ...patch,
  };
}

test("a fade loop is invisible at the start and opaque halfway through", () => {
  const anims = [{ type: "LOOP", action: "FADE", duration: 4, ease: "LINEAR" }];
  assert.equal(animationFrame(anims, env()).opacity, 0);
  assert.equal(animationFrame(anims, env({ timeSec: 2 })).opacity, 1);
});

test("fade inverted hides an item when the formula is on", () => {
  const anims = [{ type: "FORMULA", action: "FADE_INVERTED", formula: "$if(gv(on),1,0)$", ease: "LINEAR" }];
  assert.equal(animationFrame(anims, env({ formula: () => 0 })).opacity, 1);
  assert.equal(animationFrame(anims, env({ formula: () => 1 })).opacity, 0);
});

test("a switch fade follows the flag", () => {
  const anims = [{ type: "SWITCH", action: "FADE", switch: "on", ease: "LINEAR" }];
  assert.equal(animationFrame(anims, env({ flag: () => false })).opacity, 0);
  assert.equal(animationFrame(anims, env({ flag: () => true })).opacity, 1);
});

test("rotate loops through a full turn", () => {
  const anims = [{ type: "LOOP", action: "ROTATE", duration: 4, angle: 360, ease: "LINEAR" }];
  assert.equal(animationFrame(anims, env({ timeSec: 2 })).rotate, 180);
});

test("scroll moves along the angle", () => {
  const anims = [{ type: "LOOP", action: "SCROLL", duration: 2, amount: 100, angle: 0, ease: "LINEAR" }];
  const frame = animationFrame(anims, env({ timeSec: 1 }));
  assert.ok(Math.abs(frame.translateX - 50) < 0.001);
  assert.ok(Math.abs(frame.translateY) < 0.001);
});

test("scale starts at the amount and reaches full size", () => {
  const anims = [{ type: "SCROLL", action: "SCALE", amount: 50, ease: "LINEAR" }];
  assert.equal(animationFrame(anims, env({ scroll: 0 })).scale, 0.5);
  assert.equal(animationFrame(anims, env({ scroll: 1 })).scale, 1);
});

function device(): Device {
  return {
    now: new Date("2026-10-05T22:00:00Z"),
    useRealTime: false,
    hour: 22,
    minute: 0,
    battery: 40,
    charging: false,
    fast: false,
    temp: 18,
    condition: "Clear",
    humidity: 50,
    wind: 3,
    unit: "C",
    artist: "The Harbour Band",
    title: "Glass Tide",
    playing: false,
    notifications: 0,
    brightness: 100,
    ssid: "Harbor",
    bluetooth: 0,
    location: "Oslo",
    country: "NO",
    model: "Pixel",
    android: "14",
    launcher: "Pixel",
    launcherPkg: "com.google.android.apps.nexuslauncher",
    launcherVer: "14",
    darkMode: true,
    uptimeSec: 100,
    memoryUsed: 2,
    memoryTotal: 8,
    storageUsed: 20,
    storageTotal: 128,
  };
}

test("a tap toggles a switch global and music", () => {
  const globals: Record<string, GlobalDef> = { on: { type: "SWITCH", title: "On", value: 0 } };
  const phone = device();
  assert.match(applyEvent({ action: "SWITCH_GLOBAL", switch: "on" }, phone, globals), /on/i);
  assert.equal(globals.on!.value, 1);
  assert.match(applyEvent({ action: "SWITCH_GLOBAL", switch: "on" }, phone, globals), /off/i);
  assert.equal(globals.on!.value, 0);
  applyEvent({ action: "SWITCH_GLOBAL", switch: "band", switch_list: "10M" }, phone, globals);
  assert.equal(globals.band!.value, "10M");
  applyEvent({ action: "MUSIC", music_action: "PLAY" }, phone, globals);
  assert.equal(phone.playing, true);
  applyEvent({ action: "MUSIC", music_action: "NEXT" }, phone, globals);
  assert.equal(phone.title, "North Window");
  assert.match(applyEvent({ action: "LAUNCH_APP", intent: "intent:label=KLWP;end" }, phone, globals), /KLWP/);
});
