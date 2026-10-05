import { rgbaCss, toHex8 } from "./color";

export function stripBbcode(input: string): string {
  return input.replace(/\[\/?[a-z][^\]]*\]/gi, "");
}

function transformOutsideTags(input: string, fn: (part: string) => string): string {
  return input
    .split(/(\[[^\]]*\])/g)
    .map((part) => (part.startsWith("[") && part.endsWith("]") ? part : fn(part)))
    .join("");
}

export function applyCase(mode: string, input: string): string {
  const m = mode.toLowerCase();
  if (m === "low") return transformOutsideTags(input, (s) => s.toLowerCase());
  if (m === "up") return transformOutsideTags(input, (s) => s.toUpperCase());
  if (m === "cap") {
    return transformOutsideTags(input, (s) =>
      s.toLowerCase().replace(/(^|[\s._/-])([a-z])/g, (_a, pre: string, ch: string) => pre + ch.toUpperCase()),
    );
  }
  return input;
}

export function bbcodeToHtml(input: string, colorOf: (name: string) => string): string {
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withBreaks = escaped.replace(/\n/g, "<br>");
  return withBreaks.replace(/\[c=([^\]]+)\]([\s\S]*?)\[\/c\]/gi, (_all, name: string, body: string) => {
    const key = name.trim();
    const color = key.startsWith("#") ? key : colorOf(key);
    return `<span style="color:${rgbaCss(toHex8(color))}">${body}</span>`;
  });
}
