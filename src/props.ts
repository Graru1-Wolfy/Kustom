import { evalLoose, globalValue, num, type EvalCtx } from "./formula/eval";
import type { KModule } from "./types";

export function fieldPresent(mod: KModule, key: string): boolean {
  const toggle = mod.internal_toggles?.[key];
  if (Number(toggle) === 100 && mod.internal_globals?.[key]) return true;
  if (typeof mod.internal_formulas?.[key] === "string" && (toggle == null || Number(toggle) === 10)) return true;
  return mod[key] != null;
}

export function readField(mod: KModule, key: string, ctx: EvalCtx): unknown {
  const toggle = mod.internal_toggles?.[key];
  if (Number(toggle) === 100) {
    const name = mod.internal_globals?.[key];
    if (name) return globalValue(ctx, name, "");
  }
  const formula = mod.internal_formulas?.[key];
  if (typeof formula === "string" && (toggle == null || Number(toggle) === 10)) return evalLoose(formula, ctx);
  if (key in mod) return mod[key];
  return undefined;
}

export function readNumber(mod: KModule, key: string, ctx: EvalCtx, fallback = 0): number {
  if (!fieldPresent(mod, key)) return fallback;
  return num(readField(mod, key, ctx));
}

export function setLiteral(mod: KModule, key: string, value: unknown) {
  mod[key] = value;
  if (mod.internal_formulas) delete mod.internal_formulas[key];
  if (mod.internal_toggles?.[key] != null) delete mod.internal_toggles[key];
  if (mod.internal_globals?.[key]) delete mod.internal_globals[key];
}

export function setFormula(mod: KModule, key: string, formula: string) {
  mod.internal_formulas = { ...(mod.internal_formulas ?? {}), [key]: formula };
  mod.internal_toggles = { ...(mod.internal_toggles ?? {}), [key]: 10 };
  if (mod.internal_globals?.[key]) delete mod.internal_globals[key];
}

export function setGlobalLink(mod: KModule, key: string, globalName: string) {
  mod.internal_globals = { ...(mod.internal_globals ?? {}), [key]: globalName };
  mod.internal_toggles = { ...(mod.internal_toggles ?? {}), [key]: 100 };
  if (mod.internal_formulas?.[key]) delete mod.internal_formulas[key];
}

export function moduleAt(root: KModule, path: number[]): KModule | null {
  let current: KModule | null = root;
  for (const index of path) {
    const items: KModule[] | undefined = current?.viewgroup_items;
    if (!items || !items[index]) return null;
    current = items[index]!;
  }
  return current;
}

export function parentAt(root: KModule, path: number[]): { parent: KModule; index: number } | null {
  if (path.length === 0) return null;
  const parent = moduleAt(root, path.slice(0, -1));
  if (!parent?.viewgroup_items) return null;
  return { parent, index: path[path.length - 1]! };
}
