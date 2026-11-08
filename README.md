# Widgets

Frameless, transparent home-screen widgets that sit **on the desktop layer** — above the wallpaper, below every normal window. Built with Electron + Vite + React + Tailwind CSS (TypeScript).

The desktop-layer pinning is implemented for **Linux X11** (developed and verified on Linux Mint / Cinnamon) via EWMH hints. Windows and macOS builds are provided, but that specific below-every-window behavior is X11-only.

## Widgets

| Widget | Source | Notes |
| --- | --- | --- |
| Clock | `src/renderer/widgets/Clock` | 24h/12h time, seconds, weekday + date, accent rule |
| Date card | `src/renderer/widgets/DateCard` | Violet gradient, inset hairline, outlined `MMDD` numerals, script weekday |
| Calendar | `src/renderer/widgets/Calendar` | Letter-spaced `S M T W T F S`, current week bright, today inverted |
| System | `src/renderer/widgets/SystemStats` | Frosted card, arc mark, CPU / RAM / SSD readouts |
| Weather | `src/renderer/widgets/Weather` | Open-Meteo (no API key), current temp, condition, high/low |

Every widget can be shown/hidden, resized, recolored, and customized from the **Settings window** (tray → Settings…, or the gear on hover).

## Screenshots

_Screenshots will be added here._

| Clock | Calendar | Weather |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | _placeholder_ |

## Download

Get the latest installers from
**[github.com/nusratjahan7/widgets/releases](https://github.com/nusratjahan7/widgets/releases/latest)**.

| OS | Download |
| --- | --- |
| Linux (Debian/Ubuntu/Mint) | [`.deb`](https://github.com/nusratjahan7/widgets/releases/latest/download/desktop-widgets_1.0.0_amd64.deb) |
| Linux (any distro) | [`.AppImage`](https://github.com/nusratjahan7/widgets/releases/latest/download/Widgets-1.0.0.AppImage) |
| Windows | [`.exe installer`](https://github.com/nusratjahan7/widgets/releases/latest/download/Widgets%20Setup%201.0.0.exe) |
| macOS | [`.dmg`](https://github.com/nusratjahan7/widgets/releases/latest/download/Widgets-1.0.0.dmg) |

These links target the 1.0.0 assets; the [releases page](https://github.com/nusratjahan7/widgets/releases) always lists the newest builds. Releases are built automatically when a `v*` tag is pushed.

## Install

### Linux — `.deb`

```bash
sudo apt install ./desktop-widgets_1.0.0_amd64.deb
```

Launch **Widgets** from your app menu (or run `/opt/Widgets/desktop-widgets`). Uninstall with `sudo apt remove desktop-widgets`.

### Linux — AppImage

```bash
chmod +x Widgets-1.0.0.AppImage
./Widgets-1.0.0.AppImage
```

If your distro lacks FUSE, run `./Widgets-1.0.0.AppImage --appimage-extract-and-run`.

**Requirements:** X11 (not Wayland) and `wmctrl` for the desktop layer:

```bash
sudo apt install wmctrl
```

### Windows

Run the downloaded `.exe` installer. The build is **unsigned**, so Windows SmartScreen may warn:
click **More info → Run anyway**.

### macOS

Open the `.dmg`, drag **Widgets** into Applications. The build is **unsigned**, so macOS may block it:
right-click the app → **Open**, or allow it in **System Settings → Privacy & Security → Open Anyway**.
If needed, clear quarantine:

```bash
xattr -dr com.apple.quarantine /Applications/Widgets.app
```

## Build from source

```bash
npm install
npm run dev      # Vite + Electron; main-process edits restart the app
```

Other scripts:

```bash
npm run build      # icons + main (tsc) + renderer (vite)
npm start          # run the production build
npm run typecheck  # main + renderer
npm run dist       # installers for the current OS into release/
npm run icons      # regenerate assets/icon.png, assets/tray.png, build/icon.png
```

`npm run dist` builds AppImage + `.deb` on Linux, an NSIS installer on Windows, and a `.dmg` on macOS. Pushing a `v*` tag publishes all three through the workflow in `.github/workflows/release.yml`.

Tray icon → click to show/hide all widgets. Right-click for the menu:

- Settings… (`Ctrl+,`)
- Show / hide widgets
- Widgets ▸ (per-widget visibility; checking a hidden one recreates it)
- Lock position
- Theme ▸ Dark / Light / Follow system
- Accent ▸ six presets
- Start at login
- Reload widgets
- Quit

## Settings window

A normal framed window, opened from the tray (**Settings…**) or from the gear that appears on each widget on hover. It has three tabs:

- **Widgets** — every registered widget with a show/hide switch (closes/creates its window immediately), a live preview captured from the real window, and **Customize**. **Reset to default** restores each widget's options and size, keeping visibility and position.
- **Appearance** — theme mode and the six accent presets.
- **General** — start at login, lock all positions, reload widgets.

Each widget exposes a **config schema** (`src/shared/config/*.ts`) of fields with types, ranges, and defaults. The Settings UI renders those fields automatically, so a new widget needs no settings code — add its schema to the registry and it appears.

Common per-widget options: size (small/medium/large/custom), opacity, background (widget default/solid/glass/transparent), accent color, text color, corner radius, and a per-widget lock.

Widget-specific options:

| Widget | Options |
| --- | --- |
| Clock | 12/24h, show seconds, show date, time zone |
| Date card | show time, 12/24h |
| Calendar | week starts Sunday/Monday |
| System | show CPU / RAM / SSD |
| Weather | city, units (changing these updates the app-wide weather) |

> **Glass note:** transparent X11 windows cannot sample the desktop behind them, so "glass" is a translucent tinted surface rather than a true backdrop blur.

## Architecture

```
src/
  shared/          widget registry (ids + default sizes), settings types, IPC channels
    config/        per-widget config schemas + validation/defaults
    palette.ts     accent presets shared by tray and Settings
  main/
    index.ts       app lifecycle, IPC handlers, stats/weather loops
    windowManager.ts  creates/clamps/persists widget windows, desktop layer, broadcasts
    settingsWindow.ts  the framed Settings BrowserWindow
    tray.ts        tray icon + menu
    settings.ts    electron-store schema, migration/validation, widget-state helpers
    autolaunch.ts  XDG autostart entry (~/.config/autostart)
    theme.ts       theme mode/accent, nativeTheme sync
    systemStats.ts CPU delta sampling, /proc/meminfo, statfs
    weather.ts     Open-Meteo geocoding + forecast (cached, retried)
    cityEditor.ts  transient focusable popover for the weather location
    paths.ts       preload/renderer/dev-server paths
  preload/index.cts  contextBridge API (typed, contextIsolation on)
  renderer/
    widget.html    one entry, rendered per `?widget=<id>`
    editor.html    city popover entry
    settings.html  Settings window entry
    App.tsx        widget id → component map
    settings/      Settings UI (sidebar, tabs, generic field renderer)
    state/         WidgetProvider: context + stats/weather subscriptions, theme tokens
    components/     WidgetFrame (drag region, gear, live style), Mark (brand glyph)
    widgets/<Name>/ one folder per widget
    styles.css     theme tokens + component styles (Tailwind v4)
```

Each widget is its own `BrowserWindow` created from the registry in `src/shared/widgets.ts`. Bounds are stored per widget and clamped into the nearest display's work area on launch.

### Adding a widget

1. Add a config schema in `src/shared/config/<name>.ts` (widget-specific fields only).
2. Add an entry to `WIDGETS` in `src/shared/widgets.ts` (id, title, default/minimum size, schema). Common cosmetic fields are merged in automatically.
3. Create `src/renderer/widgets/<Name>/<Name>Widget.tsx`, wrapping content in `WidgetFrame` and reading its options from `useWidgetContext().config`.
4. Register it in the `RENDERERS` map in `src/renderer/App.tsx`.
5. If it needs data, add a main-process source and push it over IPC (see `systemStats.ts` + `IPC.stats`).

The Settings window, validation, and live updates work automatically for the new schema.

## How the desktop layer works

Widgets are ordinary frameless windows pinned to the bottom of the stack with the EWMH `_NET_WM_STATE_BELOW` hint, plus `skipTaskbar` and `setVisibleOnAllWorkspaces`. Electron cannot set that hint itself, so `src/main/belowLayer.ts` applies it through **wmctrl** (`wmctrl -i -r <id> -b add,below`).

Why not `type: 'desktop'`? On Cinnamon/Muffin a `_NET_WM_WINDOW_TYPE_DESKTOP` window is input-transparent: pointer events pass straight through, so widgets could not be clicked or dragged. Normal windows below the stack keep full input while still sitting behind every app window.

Verify with:

```bash
xprop -id <window> _NET_WM_STATE          # contains _NET_WM_STATE_BELOW
xprop -root _NET_CLIENT_LIST_STACKING    # widgets above the desktop, below app windows
```

If `wmctrl` is not installed, the app falls back to the desktop window type (correctly layered, but not interactive) and logs a warning. Install it with `sudo apt install wmctrl` — it is present on most X11 desktops already.

**Dragging** does not use `-webkit-app-region: drag`, which is unreliable for transparent frameless windows on X11. `WidgetFrame` streams pointer deltas over IPC (`widget:drag-*`) and the main process repositions the window with `setBounds`, pinning the persisted size so fractional scaling cannot inflate it.

**Focus:** widgets are regular focusable windows, so clicking one focuses it. Text entry lives in the separate location popover (`cityEditor.ts`) to keep the weather card itself read-only.

## Settings

Stored by `electron-store` in `~/.config/Desktop Widgets/settings.json`:

```jsonc
{
  "theme": { "mode": "dark", "accent": "#8b7ed6" },
  "locked": false,
  "autostart": false,
  "weather": { "city": "Dhaka, Dhaka Division", "latitude": 23.71, "longitude": 90.41, "units": "metric" },
  "widgets": {
    "clock": {
      "x": 1248,
      "y": 51,
      "width": 320,
      "height": 180,
      "visible": true,
      "config": {
        "size": "medium", "opacity": 1, "background": "auto",
        "accent": "auto", "textColor": "auto", "radius": 26, "locked": false,
        "hour12": false, "showSeconds": true, "showDate": true, "timezone": ""
      }
    }
  }
}
```

- **Drag** anywhere on a card; **resize** from the window edges.
- **Lock position** disables drag and resize (the drag handlers and native resize are turned off).
- Widget windows are pinned to the bottom of the stack with `_NET_WM_STATE_BELOW`; positions and sizes are restored on launch.

## Autostart

The tray toggle writes/removes `~/.config/autostart/desktop-widgets.desktop`. In development the `Exec` line points at the local Electron binary plus this project, so autostart works before packaging too.

## Weather

- Provider: Open-Meteo (no API key). Geocoding + forecast requests run through Electron's `net.fetch` so the system proxy/Chromium network stack is used.
- Initial city comes from `/etc/timezone`; resolved coordinates are cached in settings.
- Click the city name to change it. Results cache for 10 minutes; failed lookups retry after 60 seconds.

## Notes

- Requires **wmctrl** for the below-desktop layer (`sudo apt install wmctrl`), and X11 — Wayland does not expose EWMH hints.
- Startup geometry is deliberately not persisted: Chromium reports frameless transparent X11 windows a few pixels larger under fractional scaling, and saving that would compound on every launch.
- Fonts use what the system already has: `Noto Sans`, `DejaVu Sans Mono`, and `Z003` (URW Chancery) for the script weekday. No webfonts are downloaded.
- Icons are generated from code (`scripts/make-icons.mjs`, signed-distance shapes + a hand-rolled PNG encoder) so the repo carries no binary assets and needs no image dependency.
- `scripts/capture.mjs` screenshots every widget through the DevTools protocol — useful when windows are covered:

  ```bash
  ./node_modules/.bin/electron . --remote-debugging-port=9222
  node scripts/capture.mjs
  ```
