import assert from "node:assert/strict";
import test from "node:test";
import { defaultDevice } from "../device";
import { expandText, evalLoose, globalValue, makeCtx } from "./eval";

function ctx(patch: Partial<ReturnType<typeof defaultDevice>> = {}) {
  const now = new Date(2026, 9, 5, 15, 4, 7);
  const device = { ...defaultDevice(now), ...patch, now };
  return makeCtx({
    device,
    presetW: 540,
    presetH: 960,
    globalChain: [
      {
        sbhite: { type: "NUMBER", value: 38 },
        margin: { type: "NUMBER", value: 40 },
        outptcas: { type: "LIST", value: "cap" },
        "2ndcolr": { type: "COLOR", value: "#FFEF2929" },
        prompt: { type: "TEXT", value: "[c=#8AE234]zeuso[/c]$$ " },
        muscplyr: { type: "SWITCH", value: 1 },
        batrybar: {
          type: "TEXT",
          value:
            '[$tc(reg, tc(reg, fl(0, 9, "i+1", bi(level)>i*10), 1, #), 0, "-")$] ($bi(level)$$if(bi(charging) & bi(fast), "^", bi(charging) ~, "%")$)',
        },
      },
    ],
  });
}

test("formats the clock and calendar dates", () => {
  const c = ctx();
  assert.equal(evalLoose("$df(HH:mm)$", c), "15:04");
  assert.equal(evalLoose("$df(yyyy-MM-dd)$", c), "2026-10-05");
  assert.equal(evalLoose("$df(EEE)$", c), "Mon");
});

test("adds days inside df", () => {
  const c = ctx();
  c.indexStack.push(1);
  assert.equal(evalLoose('$df(EEE, a + (si(mindex)-1)/2 + d)$', c), "Mon");
  c.indexStack[0] = 3;
  assert.equal(evalLoose('$df(EEE, a + (si(mindex)-1)/2 + d)$', c), "Tue");
});

test("builds a battery bar from fl, tc and gv", () => {
  const c = ctx({ battery: 72, charging: false, fast: false });
  assert.equal(globalValue(c, "batrybar"), "[########--] (72%)");
  const fast = ctx({ battery: 100, charging: true, fast: true });
  fast.globalChain = c.globalChain;
  assert.equal(globalValue(fast, "batrybar"), "[##########] (100^)");
});

test("resolves globals, bbcode dollars and title case", () => {
  const c = ctx();
  assert.equal(expandText("$gv(prompt)$", c), "[c=#8AE234]zeuso[/c]$ ");
  assert.equal(evalLoose('$tc(gv(outptcas), "module [c=2ndcolr]ok[/c]")$', c), "Module [c=2ndcolr]Ok[/c]");
});

test("pads music metadata and reports uptime", () => {
  const c = ctx({ artist: "Ada", title: "Longer Than Twenty Chars" });
  const artist = evalLoose("$tc(rpad(tc(ell, mi(artist), 20), 23, _))$", c);
  assert.equal(artist, "Ada____________________");
  const title = String(evalLoose("$tc(ell, mi(title), 20)$", c));
  assert.equal(title.endsWith("…"), true);
  assert.equal(title.length, 20);
  assert.equal(evalLoose("$tf(df(S) - df(S, si(boot)))$", c), "3h 12m");
});

test("evaluates shape formulas against the preset size", () => {
  const c = ctx();
  assert.equal(evalLoose("$si(rwidth)$", c), 540);
  assert.equal(evalLoose("$si(rheight)-gv(sbhite)$", c), 922);
  assert.equal(evalLoose("$gv(margin)/2$", c), 20);
  assert.equal(evalLoose("#300A24", c), "#300A24");
});
