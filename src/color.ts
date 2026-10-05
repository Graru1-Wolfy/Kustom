export type Rgba = { r: number; g: number; b: number; a: number };

export function parseColor(input: unknown, fallback = "#FFFFFFFF"): Rgba {
  const raw = String(input ?? "").trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : "";
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.length === 4
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex.length === 6
          ? "FF" + hex
          : hex.length === 8
            ? hex
            : "";
  const source = full || fallback.replace("#", "");
  const n = Number.parseInt(source.slice(0, 8), 16);
  const safe = Number.isFinite(n) ? n : 0xffffffff;
  return {
    a: ((safe >> 24) & 255) / 255,
    r: (safe >> 16) & 255,
    g: (safe >> 8) & 255,
    b: safe & 255,
  };
}

export function rgbaCss(input: unknown, fallback?: string): string {
  const c = parseColor(input, fallback);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(c.a.toFixed(3))})`;
}

export function toHex8(input: unknown): string {
  const c = parseColor(input);
  const h = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return ("#" + h(c.a * 255) + h(c.r) + h(c.g) + h(c.b)).toUpperCase();
}

export function rgbHex(input: unknown): string {
  const c = parseColor(input);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return "#" + h(c.r) + h(c.g) + h(c.b);
}
