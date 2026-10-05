export type AnimFrame = {
  opacity: number;
  scale: number;
  rotate: number;
  translateX: number;
  translateY: number;
};

export type AnimEnv = {
  timeSec: number;
  scroll: number;
  unlocked: boolean;
  unlockAge: number;
  formula: (source: string) => number;
  flag: (name: string) => boolean;
};

export const REST_FRAME: AnimFrame = { opacity: 1, scale: 1, rotate: 0, translateX: 0, translateY: 0 };

export function animationFrame(anims: unknown, env: AnimEnv): AnimFrame {
  const frame = { ...REST_FRAME };
  if (!Array.isArray(anims)) return frame;
  for (const raw of anims) {
    if (!raw || typeof raw !== "object") continue;
    applyOne(raw as Record<string, unknown>, env, frame);
  }
  frame.opacity = clamp(frame.opacity, 0, 1);
  frame.scale = Math.max(0, frame.scale);
  return frame;
}

export function combineFrames(a: AnimFrame, b: AnimFrame): AnimFrame {
  return {
    opacity: clamp(a.opacity * b.opacity, 0, 1),
    scale: Math.max(0, a.scale * b.scale),
    rotate: a.rotate + b.rotate,
    translateX: a.translateX + b.translateX,
    translateY: a.translateY + b.translateY,
  };
}

export function isRest(frame: AnimFrame): boolean {
  return (
    Math.abs(frame.opacity - 1) < 0.001 &&
    Math.abs(frame.scale - 1) < 0.001 &&
    Math.abs(frame.rotate) < 0.001 &&
    Math.abs(frame.translateX) < 0.001 &&
    Math.abs(frame.translateY) < 0.001
  );
}

export function frameTransform(frame: AnimFrame): string {
  return `translate(${frame.translateX}px, ${frame.translateY}px) rotate(${frame.rotate}deg) scale(${frame.scale})`;
}

function applyOne(anim: Record<string, unknown>, env: AnimEnv, frame: AnimFrame) {
  const action = String(anim.action || "FADE").toUpperCase();
  const progress = ease(rawProgress(anim, env, action), String(anim.ease || "EASE"));
  if (action === "FADE") frame.opacity *= progress;
  else if (action === "FADE_INVERTED") frame.opacity *= 1 - progress;
  else if (action === "SCALE") {
    const from = num(anim.amount, 0) / 100;
    frame.scale *= from + (1 - from) * progress;
  } else if (action === "ROTATE") {
    frame.rotate += num(anim.angle, 360) * progress;
  } else if (action === "SCROLL") {
    const distance = num(anim.amount, 120) * progress;
    const rad = (num(anim.angle, 0) * Math.PI) / 180;
    frame.translateX += Math.cos(rad) * distance;
    frame.translateY += Math.sin(rad) * distance;
  }
}

function rawProgress(anim: Record<string, unknown>, env: AnimEnv, action: string): number {
  const type = String(anim.type || "LOOP").toUpperCase();
  const duration = Math.max(0.05, num(anim.duration, 2));
  const delay = num(anim.delay, 0);
  if (type === "SCROLL" || type === "BG") return clamp(env.scroll, 0, 1);
  if (type === "UNLOCK") {
    if (!env.unlocked) return 0;
    return clamp((env.unlockAge - delay) / duration, 0, 1);
  }
  if (type === "FORMULA") return clamp(env.formula(String(anim.formula || "0")), 0, 1);
  if (type === "SWITCH") return env.flag(String(anim.switch || anim.formula || "")) ? 1 : 0;
  const time = Math.max(0, env.timeSec - delay);
  if (action === "ROTATE" || action === "SCROLL") return (time / duration) % 1;
  const phase = (time / duration) % 1;
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

function ease(progress: number, kind: string): number {
  const p = clamp(progress, 0, 1);
  const name = kind.toUpperCase();
  if (name === "LINEAR") return p;
  if (name === "EASEIN") return p * p;
  if (name === "EASEOUT") return 1 - (1 - p) * (1 - p);
  return p * p * (3 - 2 * p);
}

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
