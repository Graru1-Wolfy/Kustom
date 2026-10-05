import { applyCase } from "../bbcode";
import type { Device, GlobalDef } from "../types";
import { isDateCode, parseFormula, type Ast } from "./parse";

export type EvalCtx = {
  device: Device;
  presetW: number;
  presetH: number;
  globalChain: Record<string, GlobalDef>[];
  indexStack: number[];
  countStack: number[];
  vars: Record<string, number | string>;
  expanding: Set<string>;
};

export function makeCtx(init: {
  device: Device;
  presetW: number;
  presetH: number;
  globalChain?: Record<string, GlobalDef>[];
}): EvalCtx {
  return {
    device: init.device,
    presetW: init.presetW,
    presetH: init.presetH,
    globalChain: init.globalChain ?? [],
    indexStack: [],
    countStack: [],
    vars: {},
    expanding: new Set(),
  };
}

export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function isTruthy(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  if (typeof value === "boolean") return value;
  const text = String(value).trim();
  return text !== "" && text !== "0" && text.toLowerCase() !== "false";
}

export function stringify(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Object.is(value, -0)) return "0";
    if (Number.isInteger(value)) return String(value);
    const rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
  }
  return String(value);
}

export function evalFormula(source: string, ctx: EvalCtx): unknown {
  return evalAst(parseFormula(source), ctx);
}

export function evalLoose(raw: unknown, ctx: EvalCtx): unknown {
  if (typeof raw !== "string") return raw ?? "";
  const source = raw.trim();
  if (!source) return "";
  if (source.includes("$")) return expandOrSingle(source, ctx);
  try {
    return evalFormula(source, ctx);
  } catch {
    return raw;
  }
}

export function expandText(input: string, ctx: EvalCtx): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "$" && input[i + 1] === "$") {
      out += "$";
      i++;
      continue;
    }
    if (input[i] !== "$") {
      out += input[i];
      continue;
    }
    const end = findFormulaEnd(input, i + 1);
    const inner = input.slice(i + 1, end);
    try {
      out += stringify(evalFormula(inner, ctx));
    } catch {
      out += "⚠";
    }
    i = end;
  }
  return out;
}

function expandOrSingle(source: string, ctx: EvalCtx): unknown {
  const match = /^\$(.*)\$$/s.exec(source.trim());
  if (match && !match[1]!.includes("$")) {
    try {
      return evalFormula(match[1]!, ctx);
    } catch {
      return expandText(source, ctx);
    }
  }
  return expandText(source, ctx);
}

function findFormulaEnd(input: string, start: number): number {
  let depth = 0;
  let quote = "";
  for (let i = start; i < input.length; i++) {
    const ch = input[i]!;
    if (quote) {
      if (ch === "\\" ) {
        i++;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "$" && depth === 0) return i;
  }
  return input.length - 1;
}

export function globalValue(ctx: EvalCtx, name: string, fallback: unknown = ""): unknown {
  if (ctx.expanding.has(name)) return fallback;
  let found: GlobalDef | undefined;
  let key = name;
  for (let i = ctx.globalChain.length - 1; i >= 0; i--) {
    const bag = ctx.globalChain[i]!;
    if (bag[name]) {
      found = bag[name];
      key = name;
      break;
    }
    for (const [candidate, global] of Object.entries(bag)) {
      if (global.title === name) {
        found = global;
        key = candidate;
        break;
      }
    }
    if (found) break;
  }
  if (!found || found.value == null) return fallback;
  const value = found.value;
  if (typeof value !== "string" || !value.includes("$")) return value;
  ctx.expanding.add(key);
  try {
    return expandOrSingle(value, ctx);
  } finally {
    ctx.expanding.delete(key);
  }
}

function evalAst(ast: Ast, ctx: EvalCtx): unknown {
  switch (ast.type) {
    case "num":
      return ast.value;
    case "str":
      return ast.value;
    case "ident":
      if (ast.name in ctx.vars) return ctx.vars[ast.name]!;
      return ast.name;
    case "un": {
      const value = evalAst(ast.expr, ctx);
      if (ast.op === "-") return -num(value);
      return isTruthy(value) ? 0 : 1;
    }
    case "bin":
      return evalBin(ast.op, evalAst(ast.left, ctx), evalAst(ast.right, ctx));
    case "call":
      return evalCall(ast, ctx);
  }
}

function evalBin(op: string, left: unknown, right: unknown): unknown {
  if (op === "+") {
    if (typeof left === "string" || typeof right === "string") return stringify(left) + stringify(right);
    return num(left) + num(right);
  }
  if (op === "-") return num(left) - num(right);
  if (op === "*") return num(left) * num(right);
  if (op === "/") {
    const divisor = num(right);
    return divisor === 0 ? 0 : num(left) / divisor;
  }
  if (op === "%") {
    const divisor = num(right);
    return divisor === 0 ? 0 : num(left) % divisor;
  }
  if (op === "&") return isTruthy(left) && isTruthy(right) ? 1 : 0;
  if (op === "|") return isTruthy(left) || isTruthy(right) ? 1 : 0;
  if (op === "~=") {
    try {
      return new RegExp(String(right)).test(String(left)) ? 1 : 0;
    } catch {
      return 0;
    }
  }
  const ln = asComparable(left);
  const rn = asComparable(right);
  const numeric = typeof ln === "number" && typeof rn === "number";
  const cmp = numeric ? ln - rn : String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
  if (op === "=") return cmp === 0 ? 1 : 0;
  if (op === "!=") return cmp !== 0 ? 1 : 0;
  if (op === ">") return cmp > 0 ? 1 : 0;
  if (op === ">=") return cmp >= 0 ? 1 : 0;
  if (op === "<") return cmp < 0 ? 1 : 0;
  if (op === "<=") return cmp <= 0 ? 1 : 0;
  return 0;
}

function asComparable(value: unknown): number | string {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return String(value);
}

function evalCall(ast: Extract<Ast, { type: "call" }>, ctx: EvalCtx): unknown {
  const name = ast.name;
  if (name === "if") return evalIf(ast.args, ctx);
  if (name === "fl") return evalFl(ast.args, ctx);
  if (name === "df") return evalDf(ast.args, ctx);
  if (name === "tf") return evalTf(ast.args, ctx);
  if (name === "gv") return globalValue(ctx, stringify(evalAst(ast.args[0]!, ctx)), ast.args[1] ? evalAst(ast.args[1], ctx) : "");
  const args = ast.args.map((arg) => evalAst(arg, ctx));
  if (name === "tc") return fnTc(args);
  if (name === "mu") return fnMu(args);
  if (name === "bi") return fnBi(stringify(args[0]), ctx);
  if (name === "wi") return fnWi(stringify(args[0]), ctx);
  if (name === "wf") return fnWf(stringify(args[0]), num(args[1]), ctx);
  if (name === "mi") return fnMi(stringify(args[0]), ctx);
  if (name === "si") return fnSi(ast, ctx);
  if (name === "nc") return fnNc(stringify(args[0]), ctx);
  if (name === "li") return fnLi(stringify(args[0]), ctx);
  if (name === "rm") return fnRm(stringify(args[0]), ctx);
  if (name === "ni") return ctx.device.notifications;
  if (name === "ai") return fnAi(stringify(args[0]), ctx);
  if (name === "len") return String(args[0] ?? "").length;
  if (name === "rpad") return padText(String(args[0] ?? ""), num(args[1]), String(args[2] ?? " "), false);
  if (name === "lpad") return padText(String(args[0] ?? ""), num(args[1]), String(args[2] ?? " "), true);
  if (name === "cm") return fnCm(args);
  return "";
}

function evalIf(args: Ast[], ctx: EvalCtx): unknown {
  for (let i = 0; i < args.length; i += 2) {
    if (i === args.length - 1) return evalAst(args[i]!, ctx);
    if (isTruthy(evalAst(args[i]!, ctx))) return evalAst(args[i + 1]!, ctx);
  }
  return "";
}

function evalFl(args: Ast[], ctx: EvalCtx): string {
  const stop = num(evalAst(args[1]!, ctx));
  const sep = args[4] ? stringify(evalAst(args[4], ctx)) : "";
  const parts: string[] = [];
  let i = num(evalAst(args[0]!, ctx));
  for (let guard = 0; guard < 500 && i <= stop + 1e-9; guard++) {
    ctx.vars.i = i;
    parts.push(stringify(evalPiece(args[3], ctx)));
    const next = num(evalPiece(args[2], ctx));
    if (!Number.isFinite(next) || Object.is(next, i)) break;
    i = next;
  }
  return parts.join(sep);
}

function evalPiece(ast: Ast | undefined, ctx: EvalCtx): unknown {
  if (!ast) return "";
  if (ast.type === "str") {
    try {
      return evalFormula(ast.value, ctx);
    } catch {
      return ast.value;
    }
  }
  return evalAst(ast, ctx);
}

function evalDf(args: Ast[], ctx: EvalCtx): string | number {
  const format = stringify(evalAst(args[0]!, ctx));
  const when = args[1] ? resolveWhen(args[1], ctx) : new Date(ctx.device.now);
  if (format === "S") return Math.floor(when.getTime() / 1000);
  return formatDate(format, when, false);
}

function evalTf(args: Ast[], ctx: EvalCtx): string {
  const span = resolveSpan(args[0]!, ctx);
  const format = args[1] ? stringify(evalAst(args[1], ctx)) : "";
  return formatDuration(span, format);
}

function resolveWhen(ast: Ast, ctx: EvalCtx): Date {
  if (ast.type === "str" && isDateCode(ast.value)) return applyDateCode(ast.value, new Date(ctx.device.now));
  if (isDateExpression(ast)) return applyDateExpression(ast, ctx);
  const value = evalAst(ast, ctx);
  if (typeof value === "number" && value > 1e12) return new Date(value);
  if (typeof value === "number" && value > 1e8) return new Date(value * 1000);
  return new Date(ctx.device.now);
}

function resolveSpan(ast: Ast, ctx: EvalCtx): number {
  if (ast.type === "str" && isDateCode(ast.value)) {
    return (applyDateCode(ast.value, new Date(ctx.device.now)).getTime() - ctx.device.now.getTime()) / 1000;
  }
  if (isDateExpression(ast)) {
    return (applyDateExpression(ast, ctx).getTime() - ctx.device.now.getTime()) / 1000;
  }
  const value = evalAst(ast, ctx);
  if (typeof value === "number" && Math.abs(value) > 1e8) return value - ctx.device.now.getTime() / 1000;
  return num(value);
}

function flattenPlus(ast: Ast): Ast[] {
  if (ast.type === "bin" && ast.op === "+") return [...flattenPlus(ast.left), ...flattenPlus(ast.right)];
  return [ast];
}

const UNIT = new Set(["y", "M", "w", "d", "h", "m", "s"]);

function isDateExpression(ast: Ast): boolean {
  if (ast.type !== "bin") return false;
  const names = flattenPlus(ast)
    .filter((part): part is Extract<Ast, { type: "ident" }> => part.type === "ident")
    .map((part) => part.name);
  return (names.includes("a") || names.includes("r")) && names.some((name) => UNIT.has(name));
}

function applyDateExpression(ast: Ast, ctx: EvalCtx): Date {
  const date = new Date(ctx.device.now);
  const parts = flattenPlus(ast);
  let sign = 1;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part.type === "ident" && (part.name === "a" || part.name === "r")) {
      sign = part.name === "r" ? -1 : 1;
      continue;
    }
    if (part.type === "ident" && UNIT.has(part.name)) continue;
    const amount = num(evalAst(part, ctx));
    let unit = "d";
    const next = parts[i + 1];
    if (next?.type === "ident" && UNIT.has(next.name)) {
      unit = next.name;
      i++;
    }
    addUnit(date, sign * amount, unit);
  }
  return date;
}

function applyDateCode(code: string, base: Date): Date {
  const date = new Date(base);
  const re = /([ar])?(\d+(?:\.\d+)?)([yMwdhms])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code))) {
    const dir = match[1];
    const amount = Number(match[2]);
    const unit = match[3]!;
    if (!dir) setUnit(date, amount, unit);
    else addUnit(date, (dir === "r" ? -1 : 1) * amount, unit);
  }
  return date;
}

function setUnit(date: Date, amount: number, unit: string) {
  const n = Math.trunc(amount);
  if (unit === "y") date.setFullYear(n);
  else if (unit === "M") date.setMonth(n - 1);
  else if (unit === "d") date.setDate(n);
  else if (unit === "h") date.setHours(n);
  else if (unit === "m") date.setMinutes(n);
  else if (unit === "s") date.setSeconds(n);
  else if (unit === "w") date.setDate(n * 7);
}

function addUnit(date: Date, amount: number, unit: string) {
  const n = amount;
  if (unit === "y") date.setFullYear(date.getFullYear() + n);
  else if (unit === "M") date.setMonth(date.getMonth() + n);
  else if (unit === "w") date.setDate(date.getDate() + n * 7);
  else if (unit === "d") date.setDate(date.getDate() + n);
  else if (unit === "h") date.setHours(date.getHours() + n);
  else if (unit === "m") date.setMinutes(date.getMinutes() + n);
  else if (unit === "s") date.setSeconds(date.getSeconds() + n);
}

export function formatDate(format: string, date: Date, hour12: boolean): string {
  let out = "";
  let i = 0;
  while (i < format.length) {
    if (format[i] === "'") {
      i++;
      let literal = "";
      while (i < format.length && format[i] !== "'") literal += format[i++]!;
      if (format[i] === "'") i++;
      out += literal;
      continue;
    }
    const match = /^(yyyy|EEEE|MMMM|HH|hh|mm|ss|dd|EEE|MMM|DDD|yy|MM|kk|a|A|H|h|m|s|d|M|D|E|w|f|o|S)/.exec(format.slice(i));
    if (!match) {
      out += format[i]!;
      i++;
      continue;
    }
    out += dateToken(match[1]!, date, hour12);
    i += match[1]!.length;
  }
  return out;
}

function dateToken(token: string, date: Date, hour12: boolean): string {
  const hours = date.getHours();
  const h12 = hours % 12 || 12;
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const weekShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  switch (token) {
    case "yyyy":
      return String(date.getFullYear());
    case "yy":
      return pad(date.getFullYear() % 100);
    case "MMMM":
      return monthLong[date.getMonth()]!;
    case "MMM":
      return monthShort[date.getMonth()]!;
    case "MM":
      return pad(date.getMonth() + 1);
    case "M":
      return String(date.getMonth() + 1);
    case "dd":
      return pad(date.getDate());
    case "d":
      return String(date.getDate());
    case "EEEE":
      return weekLong[date.getDay()]!;
    case "EEE":
    case "E":
      return weekShort[date.getDay()]!;
    case "HH":
    case "kk":
      return pad(hours);
    case "H":
      return String(hours);
    case "hh":
      return pad(h12);
    case "h":
      return String(h12);
    case "mm":
      return pad(date.getMinutes());
    case "m":
      return String(date.getMinutes());
    case "ss":
      return pad(date.getSeconds());
    case "s":
      return String(date.getSeconds());
    case "a":
      return hour12 ? (hours < 12 ? "AM" : "PM") : "";
    case "A":
      return hours < 12 ? "AM" : "PM";
    case "D":
    case "DDD":
      return token === "DDD" ? pad(dayOfYear(date), 3) : String(dayOfYear(date));
    case "w":
      return String(Math.ceil(dayOfYear(date) / 7));
    case "f":
      return String(date.getDay() === 0 ? 7 : date.getDay());
    case "o":
      return String(new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
    case "S":
      return String(Math.floor(date.getTime() / 1000));
    default:
      return token;
  }
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function formatDuration(seconds: number, format: string): string {
  const sign = seconds < 0 ? "-" : "";
  let rest = Math.abs(Math.round(seconds));
  const days = Math.floor(rest / 86400);
  rest %= 86400;
  const hours = Math.floor(rest / 3600);
  rest %= 3600;
  const minutes = Math.floor(rest / 60);
  const secs = rest % 60;
  if (!format) {
    if (days > 0) return `${sign}${days}d ${hours}h`;
    if (hours > 0) return `${sign}${hours}h ${minutes}m`;
    if (minutes > 0) return `${sign}${minutes}m ${secs}s`;
    return `${sign}${secs}s`;
  }
  return (
    sign +
    format
      .replace(/dd/g, String(days).padStart(2, "0"))
      .replace(/hh/g, String(hours).padStart(2, "0"))
      .replace(/mm/g, String(minutes).padStart(2, "0"))
      .replace(/ss/g, String(secs).padStart(2, "0"))
      .replace(/d/g, String(days))
      .replace(/h/g, String(hours))
      .replace(/m/g, String(minutes))
      .replace(/s/g, String(secs))
  );
}

function fnTc(args: unknown[]): unknown {
  if (args.length <= 1) return args[0] ?? "";
  const mode = String(args[0]).toLowerCase();
  const text = String(args[1] ?? "");
  if (mode === "low" || mode === "up" || mode === "cap") return applyCase(mode, text);
  if (mode === "len") return text.length;
  if (mode === "cut") return cutText(text, num(args[2]), args[3]);
  if (mode === "ell") return ellipsis(text, num(args[2]));
  if (mode === "lpad") return padText(text, num(args[2]), String(args[3] ?? "0"), true);
  if (mode === "rpad") return padText(text, num(args[2]), String(args[3] ?? " "), false);
  if (mode === "reg") return replaceReg(text, String(args[2] ?? ""), String(args[3] ?? ""));
  if (mode === "count") return text.split(String(args[2] ?? "")).length - 1;
  if (mode === "split") return text.split(String(args[2] ?? ""))[num(args[3])] ?? "";
  return text;
}

function cutText(text: string, startOrLen: number, maybeLen: unknown): string {
  if (maybeLen == null) {
    if (startOrLen < 0) return text.slice(startOrLen);
    return text.slice(0, startOrLen);
  }
  return text.slice(startOrLen, startOrLen + num(maybeLen));
}

function ellipsis(text: string, length: number): string {
  if (text.length <= length) return text;
  if (length <= 1) return "…".slice(0, Math.max(0, length));
  return text.slice(0, length - 1) + "…";
}

function padText(text: string, length: number, ch: string, left: boolean): string {
  const pad = ch || (left ? "0" : " ");
  if (text.length >= length) return text;
  let extra = "";
  while (text.length + extra.length < length) extra += pad;
  extra = extra.slice(0, Math.max(0, length - text.length));
  return left ? extra + text : text + extra;
}

function replaceReg(text: string, pattern: string, replacement: string): string {
  try {
    return text.replace(new RegExp(pattern, "g"), () => replacement);
  } catch {
    return text.split(pattern).join(replacement);
  }
}

function fnMu(args: unknown[]): number {
  const op = String(args[0] ?? "");
  const a = num(args[1]);
  const b = num(args[2]);
  switch (op) {
    case "round":
      if (args.length >= 3 && args[2] != null && String(args[2]) !== "") {
        const places = 10 ** Math.floor(num(args[2]));
        return Math.round(a * places) / places;
      }
      return Math.round(a);
    case "floor":
      return Math.floor(a);
    case "ceil":
      return Math.ceil(a);
    case "sqrt":
      return Math.sqrt(a);
    case "abs":
      return Math.abs(a);
    case "min":
      return Math.min(...args.slice(1).map(num));
    case "max":
      return Math.max(...args.slice(1).map(num));
    case "pow":
      return a ** b;
    case "log":
      return Math.log10(a);
    case "ln":
      return Math.log(a);
    case "sin":
      return Math.sin((a * Math.PI) / 180);
    case "cos":
      return Math.cos((a * Math.PI) / 180);
    case "tan":
      return Math.tan((a * Math.PI) / 180);
    case "rnd":
      return Math.floor(a + Math.random() * (b - a + 1));
    default:
      return a;
  }
}

function fnBi(kind: string, ctx: EvalCtx): unknown {
  const device = ctx.device;
  switch (kind) {
    case "level":
      return device.battery;
    case "charging":
      return device.charging ? 1 : 0;
    case "fast":
      return device.fast ? 1 : 0;
    case "temp":
    case "tempc":
      return 31;
    case "volt":
      return 4150;
    case "current":
      return device.charging ? 1800 : -420;
    case "source":
      return device.charging ? "AC" : "Battery";
    default:
      return 0;
  }
}

function fnWi(kind: string, ctx: EvalCtx): unknown {
  const device = ctx.device;
  switch (kind) {
    case "temp":
    case "tempc":
      return device.temp;
    case "tempu":
      return device.unit;
    case "cond":
      return device.condition;
    case "hum":
      return device.humidity;
    case "wspeed":
      return device.wind;
    case "icon":
    case "code":
      return device.condition.toUpperCase().replace(/\s+/g, "_");
    default:
      return "";
  }
}

function fnWf(kind: string, index: number, ctx: EvalCtx): unknown {
  const day = Math.trunc(index);
  const shift = (Math.abs(day) % 5) - 1;
  const conditions = ["Clear", "Cloudy", "Rain", "Fair", "Wind"];
  if (kind === "min") return Math.round(ctx.device.temp - 4 + shift);
  if (kind === "max") return Math.round(ctx.device.temp + 3 + shift);
  if (kind === "cond" || kind === "icon" || kind === "code") return conditions[(Math.abs(day) + conditions.length) % conditions.length]!;
  return "";
}

function fnMi(kind: string, ctx: EvalCtx): unknown {
  const device = ctx.device;
  switch (kind) {
    case "artist":
      return device.artist;
    case "title":
      return device.title;
    case "state":
      return device.playing ? "playing" : "stopped";
    case "package":
      return "com.android.music";
    case "album":
      return "";
    default:
      return "";
  }
}

function fnSi(ast: Extract<Ast, { type: "call" }>, ctx: EvalCtx): unknown {
  const kind = stringify(evalAst(ast.args[0]!, ctx));
  const extra = ast.args[1] ? evalAst(ast.args[1]!, ctx) : undefined;
  const device = ctx.device;
  switch (kind) {
    case "rwidth":
      return ctx.presetW;
    case "rheight":
      return ctx.presetH;
    case "mindex": {
      const up = num(extra ?? 0);
      return ctx.indexStack[ctx.indexStack.length - 1 - up] ?? 0;
    }
    case "mcount": {
      const up = num(extra ?? 0);
      return ctx.countStack[ctx.countStack.length - 1 - up] ?? 0;
    }
    case "aver":
      return device.android;
    case "model":
      return device.model;
    case "man":
      return "Google";
    case "boot":
      return Math.floor(device.now.getTime() / 1000) - device.uptimeSec;
    case "darkmode":
      return device.darkMode ? 1 : 0;
    case "lnchpkg":
      return device.launcherPkg;
    case "lnchname":
      return device.launcher;
    case "pkgname":
      return extra ? device.launcher : "Kustom";
    case "pkgvern":
    case "pkgver":
      return extra ? device.launcherVer : "1.0";
    case "alarmon":
    case "locked":
    case "land":
      return 0;
    case "system":
      return String(extra) === "screen_brightness" ? device.brightness : 0;
    default:
      return 0;
  }
}

function fnNc(kind: string, ctx: EvalCtx): unknown {
  switch (kind) {
    case "ssid":
      return ctx.device.ssid;
    case "bt":
      return ctx.device.bluetooth;
    case "wifi":
      return ctx.device.ssid ? "CONNECTED" : "DISABLED";
    case "operator":
      return "Kustom";
    case "csig":
      return 4;
    case "wsig":
      return 8;
    default:
      return 0;
  }
}

function fnLi(kind: string, ctx: EvalCtx): unknown {
  switch (kind) {
    case "ccode":
      return ctx.device.country;
    case "loc":
      return ctx.device.location;
    case "spdu":
      return "km/h";
    default:
      return "";
  }
}

function fnRm(kind: string, ctx: EvalCtx): unknown {
  switch (kind) {
    case "mused":
      return ctx.device.memoryUsed;
    case "mtot":
      return ctx.device.memoryTotal;
    case "fsused":
      return ctx.device.storageUsed;
    case "fstot":
      return ctx.device.storageTotal;
    default:
      return 0;
  }
}

function fnAi(kind: string, ctx: EvalCtx): unknown {
  const hour = ctx.device.now.getHours();
  if (kind === "isday") return hour >= 7 && hour < 19 ? 1 : 0;
  return 0;
}

function fnCm(args: unknown[]): string {
  const hasAlpha = args.length >= 4;
  const r = hasAlpha ? num(args[1]) : num(args[0]);
  const g = hasAlpha ? num(args[2]) : num(args[1]);
  const b = hasAlpha ? num(args[3]) : num(args[2]);
  const a = hasAlpha ? num(args[0]) : 255;
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return ("#" + hex(a) + hex(r) + hex(g) + hex(b)).toUpperCase();
}
