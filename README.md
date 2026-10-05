# Kustom

A what-you-see-is-what-you-get editor for [KLWP](https://kustom.rocks) live wallpaper presets. Open a `.klwp` file, move and restyle items on a phone canvas, then export a preset the KLWP app can import.

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

The sample wallpaper is loaded on startup. `Blank` starts from an empty screen.

## How the preview works

A preset is a ZIP whose `preset.json` is a tree of modules. Overlap groups place children by anchor and padding. Stack groups flow them. Text, colors, and sizes can be Kustom formulas (`$df(HH:mm)$`, `$bi(level)$`, `$gv(name)$`, and the usual `if`, `tc`, `fl`, `wi`, `si`, `mi` set). The preview evaluates those against the clock and the Preview panel.

Unknown formula functions come through as blank rather than breaking the file. Position formulas are kept until you drag that item, which replaces them with a fixed anchor. Animations are shown in their resting state.
