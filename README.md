# Kustom

A what-you-see-is-what-you-get editor for [KLWP](https://kustom.rocks) live wallpaper presets. Open a `.klwp` file, move and restyle items on a phone canvas, then export a preset the KLWP app can import.

The editor is published at https://graru1-wolfy.github.io/Kustom/.

```bash
npm install
npm test
npm run dev
```

The dev server runs at http://localhost:5173.

## What you can do

- Open `.klwp`, `.klwp.zip`, preset JSON, or a Kustom clipboard clip. Fonts packed in the archive are used for the preview.
- Drag items, resize shapes, edit text and colors, and reorder layers.
- Edit globals (colors, numbers, text, switches). Items linked to a global update together.
- Scrub the preview: battery, weather, music, time of day, and the other values formulas read.
- Export `.klwp`. The original archive assets are kept, and `preset.json` is replaced.

## Advanced builder

`Advanced` opens the builder used to design a preset, not only to nudge one that already exists.

- **Tools** are grouped toolsets: draw, time, status, controls, and motion. Save the selected item into a named toolset; it stays in this browser.
- **Formula** binds a property to a Kustom formula and shows the live result. The chips insert `df`, `if`, `bi`, `gv`, and the rest of the implemented set.
- **Form** is the preset's global form: color, number, text, switch, and list. The preview at the top is the input someone fills in, and `gv()` reads it.
- **Animate** writes KLWP `internal_animations` (loop, scroll, unlock, formula, switch) with fade, scale, rotate, and scroll. Loops play on the phone.
- **Color** edits `#AARRGGBB`, including alpha, gradients, and links to color globals.
- **Events** write taps: toggle a global, set a list entry, control music, or record a link or app launch. **Interact** makes a tap on the phone run the event.
- **Source** is the module or preset JSON. **Input** under it is what that item evaluates to, plus the globals it reads.

The sample wallpaper is loaded on startup. `Blank` starts from an empty screen.

## How the preview works

A preset is a ZIP whose `preset.json` is a tree of modules. Overlap groups place children by anchor and padding. Stack groups flow them. Text, colors, and sizes can be Kustom formulas (`$df(HH:mm)$`, `$bi(level)$`, `$gv(name)$`, and the usual `if`, `tc`, `fl`, `wi`, `si`, `mi` set). The preview evaluates those against the clock and the Preview panel.

Unknown formula functions come through as blank rather than breaking the file. Position formulas are kept until you drag that item, which replaces them with a fixed anchor. Loop, formula, and switch animations play on the canvas. Scroll and unlock animations follow the sliders in Animate.
