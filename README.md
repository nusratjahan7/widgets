# Widgets

Frameless, transparent home-screen widgets that sit **on the desktop layer** — above the wallpaper, below every normal window. Built with Electron + Vite + React + Tailwind CSS (TypeScript).

On Linux the widgets are real desktop windows (`_NET_WM_WINDOW_TYPE_DESKTOP`), so Cinnamon's Scale/Expo overviews and Alt+Tab leave them alone while they remain clickable, draggable, and resizable. They are **not** listed in the taskbar and stay visible on every workspace. Windows and macOS builds use regular frameless windows.

## Features

- Six widgets: clock, typographic date card, calendar, system stats, weather, and reminders.
- Win+V-style clipboard panel (`--toggle`) with recent emoji, skin-tone emoji, Tenor GIFs, kaomoji, symbols, and clipboard history.
- Drag to move; drag any edge or corner to resize (independently of the WM), with a per-widget or global lock.
- Live Settings window with a generic schema renderer, per-widget live previews, themes, accent colors, and sizes.
- Tray icon and single-instance launcher so Settings is always reachable.
- Reminder editor popover with repeating events and desktop notifications.
- Locally bundled fonts (Bebas Neue, Anton, Oswald, Pacifico, Dancing Script, Inter) — works offline.

## Widgets

| Widget | Source | Notes |
| --- | --- | --- |
| Clock | `src/renderer/widgets/Clock` | 24h/12h time, seconds, weekday + date, accent rule |
| Date card | `src/renderer/widgets/DateCard` | Frosted gradient card, hollow time numerals, script weekday, short date |
| Calendar | `src/renderer/widgets/Calendar` | Letter-spaced `S M T W T F S`, current week bright, today inverted |
| System | `src/renderer/widgets/SystemStats` | Frosted card, arc mark, CPU / RAM / SSD readouts |
| Weather | `src/renderer/widgets/Weather` | Open-Meteo (no API key), current temp, condition, high/low |
| Reminders | `src/renderer/widgets/Reminder` | Weekday/month header, big day number, next reminders with colored bars and times |

Every widget can be shown/hidden, moved, resized, recolored, and customized from the **Settings window** (tray → Open Settings, or the gear on hover).

## Screenshots

_Screenshots will be added here._

| Clock | Calendar | Weather |
| --- | --- | --- |
| _placeholder_ | _placeholder_ | _placeholder_ |

## Download

Get the latest installers from
**[github.com/nusratjahan7/widgets/releases/latest](https://github.com/nusratjahan7/widgets/releases/latest)**.

| OS | Download |
| --- | --- |
| Linux (Debian/Ubuntu/Mint) | [`.deb`](https://github.com/nusratjahan7/widgets/releases/latest/download/desktop-widgets_1.3.0_amd64.deb) |
| Linux (any distro) | [`.AppImage`](https://github.com/nusratjahan7/widgets/releases/latest/download/Widgets-1.3.0.AppImage) |
| Windows | [`.exe installer`](https://github.com/nusratjahan7/widgets/releases/latest/download/Widgets.Setup.1.3.0.exe) |
| macOS (Apple Silicon) | [`.dmg`](https://github.com/nusratjahan7/widgets/releases/latest/download/Widgets-1.3.0-arm64.dmg) |

These links target the 1.3.0 assets; the [releases page](https://github.com/nusratjahan7/widgets/releases) always lists the newest builds. Releases are built automatically when a `v*` tag is pushed.

## Install

### Linux — `.deb`

```bash
sudo apt install ./desktop-widgets_1.3.0_amd64.deb
```

The package depends on `libayatana-appindicator3-1` (tray integration), along with the usual Electron libraries. Launch **Widgets** from your app menu (or run `/opt/Widgets/desktop-widgets`). Uninstall with `sudo apt remove desktop-widgets`.

### Linux — AppImage

```bash
chmod +x Widgets-1.3.0.AppImage
./Widgets-1.3.0.AppImage
```

If your distro lacks FUSE, run `./Widgets-1.3.0.AppImage --appimage-extract-and-run`.

**Requirements:** Linux X11 (not Wayland) for the true desktop layer. No `wmctrl` or other helper is needed.

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

`npm run dist` builds AppImage + `.deb` on Linux, an NSIS installer on Windows, and a `.dmg` on macOS. Pushing a `v*` tag publishes all three through `.github/workflows/release.yml`.

Release CI fetches Electron and the electron-builder tools from mirrors (`ELECTRON_MIRROR` and `ELECTRON_BUILDER_BINARIES_MIRROR`) so upstream download outages do not break release builds.

## Tray and dock

- The tray icon shows a menu with **Open Settings**, **Show / Hide widgets**, and **Quit**. Left-clicking the tray icon opens Settings.
- Closing the Settings window hides it; the app keeps running with the widgets. Reopen it from the tray, by launching the app again (single-instance), or by clicking the pinned dock icon.
- **Keep a dock icon while Settings is closed** (Settings → General, off by default) creates a tiny transparent minimized window so the panel keeps an app entry. It may also appear in Alt+Tab/task switchers.
- Quit only from the tray menu or **Settings → General → Quit**.

## Dock and window previews

The app includes its own Bottom/Left/Right dock that can replace Plank. On first run it seeds its pinned icons from `~/.config/plank/dock1/launchers/*.dockitem`, and **Replace Plank on login** renames the Plank autostart entry (never deletes it).

- Windows are grouped by **WM_CLASS**, so every window of one app sits under one icon. Docks, panels, and desktop windows are filtered out by `_NET_WM_WINDOW_TYPE`.
- Hovering an icon for the configured delay opens a frosted card row above it: one card per window with a captured thumbnail, app icon, ellipsized title, and a close (X) button.
- Click a card to focus/raise its window (minimized windows are restored). Middle-click a card or click **X** to close that window only.
- Moving from the icon onto a card does not flicker: the main process samples the real cursor and keeps the card open while the pointer is over either the icon or the card, then closes it after a short grace period.
- Thumbnails come from `desktopCapturer.getSources({ types: ['window'] })` and are refreshed every 1.5 s **only while a card is open**. Minimized or hidden windows fall back to the app icon.
- Indicators: a short dot for running apps, a longer accent bar for the focused app, and a small count pill when an app has several windows.
- **X11 only.** On Wayland the dock still launches apps, but hovering shows a notice that thumbnails require X11.

Window control uses `wmctrl` and `xprop` (from the `wmctrl` and `x11-utils` packages, listed as `.deb` dependencies) instead of `xdotool` or a native X11 binding: they ship with Mint, need no build step, and `wmctrl -lxp` already returns the pid, WM_CLASS, and title used for grouping. `_NET_WM_STRUT_PARTIAL` (space reservation) is written by a small bundled `python3` ctypes helper; if Python is missing, the dock floats and the Settings tab suggests Auto-hide.

Settings → **Dock** controls enable, previews, icon size, hover zoom, position, auto-hide, hover delay, thumbnail width, close button, and Plank replacement.

### Testing previews

1. Stop the old dock (`pkill plank`) or use **Settings → Dock → Stop Plank**.
2. Open two windows of one app, e.g. `nemo ~/Documents & nemo ~/Downloads &`.
3. Hover the Files icon for ~300 ms — two cards appear, centered above the icon, with a `2` indicator.
4. Click the background card — that window raises and takes focus.
5. Middle-click a card (or click its X) — only that window closes; the indicator drops to `1`.
6. Move the pointer from the icon to a card across the gap — it must not close until you leave both.

## Clipboard panel

A Win+V-style frameless panel (about 420×520) that opens near the cursor and hides on blur or Esc. Six tabs: **Recent**, **Emoji**, **GIF**, **Kaomoji**, **Symbols**, and **Clipboard history**. Selecting an item copies it, hides the panel, and — when a paste helper is available — pastes it into the window that was focused before.

- Launch/toggle with `desktop-widgets --toggle` (installed) or `./Widgets-1.3.0.AppImage --toggle`. A second launch toggles the running instance; launching with the flag when the app is not running starts it as usual and opens the panel.
- Bind it to **Super+V**:
  - **GNOME**: Settings → Keyboard → Custom Shortcuts → add `desktop-widgets --toggle` on Super+V, then disable the existing “Toggle message tray” Super+V binding.
  - **KDE**: System Settings → Shortcuts → Custom → add the same command, then disable KDE's built-in clipboard Super+V action.
- Optional helpers, detected at runtime. Without them the panel copies only:
  - X11 paste: `sudo apt install xdotool`
  - Wayland watching: `sudo apt install wl-clipboard` (provides `wl-paste`)
  - Wayland paste: `wtype` or `ydotool`
- GIFs use the Tenor API. Paste a free key from [tenor.com/google-apis](https://tenor.com/google-apis) in **Settings → Clipboard**; it is stored locally in `settings.json`. Search and trending are attributed “Powered by Tenor.”
- Clipboard watching polls every 500 ms on X11. On Wayland it uses `wl-paste --watch` when available and falls back to polling. History keeps the 50 newest text/image items, skips duplicates, and supports pin, delete, and clear all.
- History is local: `~/.config/Widgets/clipboard-panel.json` plus the `clipboard-panel-media/` folder for image entries. Turn off **Watch clipboard history** in Settings → Clipboard to stop recording; **Clear history** deletes it. Entries tagged by password managers (`x-kde-passwordManagerHint`) are skipped.
- Keyboard: arrows move the selection, Enter copies the selected item, Tab/Shift+Tab switch tabs, and Esc clears a search or closes the panel.

## Settings window

A normal framed window, opened from the tray or from the gear on each widget on hover. It has five tabs:

- **Widgets** — every registered widget with a show/hide switch (closes/creates its window immediately), a live preview captured from the real window, and **Customize**. **Reset to default** restores each widget's options and size, keeping visibility and position.
- **Dock** — the dock options above, plus session/space-reservation status and Stop/Start Plank.
- **Clipboard** — enable the panel, watch clipboard history, auto-paste, and the Tenor API key.
- **Appearance** — theme mode and the six accent presets.
- **General** — start at login, keep-dock-icon placeholder, lock all positions, reload widgets, quit, settings file location.

Each widget exposes a **config schema** (`src/shared/config/*.ts`) of fields with types, ranges, and defaults. The Settings UI renders those fields automatically, so a new widget needs no settings code — add its schema to the registry and it appears. Dropdowns are a custom themed control so native menu colors cannot break the dark UI.

Common per-widget options: size (small/medium/large/custom), opacity, background (widget default/solid/glass/transparent), accent color, text color, corner radius, and a per-widget lock.

Widget-specific options:

| Widget | Options |
| --- | --- |
| Clock | 12/24h, show seconds, show date, time zone |
| Date card | show time, 12/24h, show weekday, show short date, date format, outline thickness, fill opacity, gradient preset, background opacity, blur, numeral font, script font |
| Calendar | week starts Sunday/Monday |
| System | show CPU / RAM / SSD |
| Weather | city, units (changing these updates the app-wide weather) |
| Reminders | theme (light/dark/glass), weekday color, default reminder color, reminders shown (1–3), 12/24h, notifications, default lead time |

> **Glass note:** transparent X11 windows cannot reliably sample the desktop behind them, so "glass" is a translucent tinted surface rather than a true backdrop blur.

## Reminders

- Click the Reminders widget (not the gear) to open a focusable popover for adding, editing, and deleting reminders.
- Each reminder has a title, date, start/end time, color, repeat (none / daily / weekly / monthly), and an optional lead-time override.
- The widget shows today's upcoming (or currently ongoing) reminders, sorted by time, limited by **Reminders shown**.
- A main-process scheduler checks every 20 seconds, after edits, and on system resume. It sends an Electron notification at `start − lead` (per-reminder override, otherwise the default from Settings).
- Notifications require the app to be running. Events older than the 60-second grace window are not replayed after a restart.

## Architecture

```
src/
  shared/          widget registry (ids + default sizes), settings types, IPC channels
    config/        per-widget config schemas + validation/defaults
    reminders.ts   occurrence/repeat math shared by widget and scheduler
    palette.ts     accent presets shared by tray and Settings
  main/
    index.ts       app lifecycle, IPC handlers, stats/weather/reminder loops
    windowManager.ts  creates/clamps/persists widget windows, desktop layer, drag/resize, broadcasts
    settingsWindow.ts  the framed Settings BrowserWindow (hide on close)
    tray.ts        tray icon + menu (packaged icon from resources/tray.png)
    dockIcon.ts    optional 1×1 placeholder window for dock presence
    x11.ts         wmctrl/xprop window listing, focus/close, minimized + session checks
    clipboard-panel/  Win+V panel: controller, clipboard watcher, history/recents stores, paste helper, Tenor, image protocol
    desktopEntry.ts  .desktop parsing, icon resolution, launching, Plank launcher seeding
    dock.ts        dock controller: poll loop, WM_CLASS grouping, hover state machine, actions
    dockWindow.ts  dock BrowserWindow geometry, auto-hide, strut lifecycle
    dockPreview.ts preview BrowserWindow, positioning, thumbnail capture poll
    dockStrut.ts   bundled ctypes helper for _NET_WM_STRUT_PARTIAL
    plank.ts       reversible Plank autostart toggle and stop/start
    appState.ts    quit flag used by the Settings close handler
    settings.ts    electron-store schema, migration/validation, widget-state helpers
    reminders.ts   separate electron-store (reminders.json), CRUD + broadcast
    reminderScheduler.ts  desktop notifications, resume/restart safe
    reminderEditor.ts     popover editor window anchored to the widget
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
    reminder.html  reminder editor popover entry
    settings.html  Settings window entry
    dock.html      dock bar entry
    preview.html   preview card row entry
    clipboard-panel/  index.html + six-tab panel UI (Recent, Emoji, GIF, Kaomoji, Symbols, History)
    App.tsx        widget id → component map
    settings/      Settings UI (sidebar, tabs, generic field renderer, SelectControl, DockTab)
    dock/          dock icons, magnification, snapshot subscription
    preview/       preview card row and thumbnails
    state/         WidgetProvider: context + stats/weather subscriptions, theme tokens
    hooks/         useNow, useMinuteClock (minute/midnight + resume)
    components/    WidgetFrame (drag, resize handles, gear, tap-to-open, live style), Mark
    widgets/<Name>/ one folder per widget
    fonts/         bundled WOFF2 fonts + OFL licenses
    styles.css     theme tokens + component styles (Tailwind v4)
```

Each widget is its own `BrowserWindow` created from the registry in `src/shared/widgets.ts`. Bounds are stored per widget and clamped into the nearest display's work area on launch.

### Adding a widget

1. Add a config schema in `src/shared/config/<name>.ts` (widget-specific fields only).
2. Add an entry to `WIDGETS` in `src/shared/widgets.ts` (id, title, default/minimum size, schema). Common cosmetic fields are merged in automatically.
3. Create `src/renderer/widgets/<Name>/<Name>Widget.tsx`, wrapping content in `WidgetFrame` and reading its options from `useWidgetContext().config`.
4. Register it in the `RENDERERS` map in `src/renderer/App.tsx`.
5. If it needs data, add a main-process source and push it over IPC (see `systemStats.ts` + `IPC.stats`).

The Settings window, validation, live updates, tray entries, and previews work automatically for the new schema.

## How the desktop layer works

On Linux, widget windows are created with `type: 'desktop'`, which sets `_NET_WM_WINDOW_TYPE_DESKTOP`. Muffin/Cinnamon then:

- keeps them below normal windows,
- excludes them from Scale/Expo and Alt+Tab,
- keeps them off the taskbar (`skipTaskbar`), and
- shows them on every workspace via `setVisibleOnAllWorkspaces(true)`.

Widgets remain fully interactive. **Dragging** streams pointer deltas over IPC (`widget:drag-*`) and repositions the window with `setBounds`. **Resizing** uses invisible edge/corner handles that stream `widget:resize-*` events; the main process computes new bounds from the chosen edge, enforces minimum sizes, clamps to the display, and persists them. Because `type: 'desktop'` windows are not resizable by the WM, this custom path is what makes resize work at all.

Verify with:

```bash
xprop -id <window> _NET_WM_WINDOW_TYPE    # _NET_WM_WINDOW_TYPE_DESKTOP
```

The Settings window is a normal window (`_NET_WM_WINDOW_TYPE_NORMAL`, `skipTaskbar: false`), so it appears in the dock and Scale as usual. Text entry lives in normal popover windows (weather location, reminder editor) because desktop-layer windows cannot take keyboard focus on Cinnamon.

## Settings and data

`electron-store` keeps data in `~/.config/Widgets/`:

- `settings.json` — theme, autostart, lock state, dock placeholder, weather, clipboard-panel options, and per-widget state/config.
- `reminders.json` — the global reminder list.
- `clipboard-panel.json` — clipboard history (max 50) and the last 30 used emoji/symbols/kaomoji.
- `clipboard-panel-media/` — PNG files backing image entries in the clipboard history.

```jsonc
// settings.json (excerpt)
{
  "theme": { "mode": "dark", "accent": "#8b7ed6" },
  "locked": false,
  "autostart": false,
  "keepDockIcon": false,
  "weather": { "city": "Dhaka, Dhaka Division", "latitude": 23.71, "longitude": 90.41, "units": "metric" },
  "clipboardPanel": { "enabled": true, "historyEnabled": true, "autoPaste": true, "tenorApiKey": "" },
  "widgets": {
    "clock": {
      "x": 1248, "y": 51, "width": 320, "height": 180, "visible": true,
      "config": {
        "size": "medium", "opacity": 1, "background": "auto",
        "accent": "auto", "textColor": "auto", "radius": 26, "locked": false,
        "hour12": false, "showSeconds": true, "showDate": true, "timezone": ""
      }
    }
  }
}
```

- **Drag** anywhere on a widget to move it; **resize** from any edge or corner.
- **Lock position** disables drag, resize, and the resize handles for that widget; the global lock in General disables them for all widgets.
- Positions, sizes, and configs are restored on launch. A drag/resize marks the widget's size as `custom` so Settings reflects it.

## Autostart

The tray toggle writes/removes `~/.config/autostart/desktop-widgets.desktop`. In development the `Exec` line points at the local Electron binary plus this project, so autostart works before packaging too.

## Weather

- Provider: Open-Meteo (no API key). Geocoding + forecast requests run through Electron's `net.fetch` so the system proxy/Chromium network stack is used.
- Initial city comes from `/etc/timezone`; resolved coordinates are cached in settings.
- Click the city name to change it. Results cache for 10 minutes; failed lookups retry after 60 seconds.

## Notes

- Requires Linux **X11** for the desktop layer; Wayland does not expose the EWMH desktop-window behavior.
- The tray icon needs AppIndicator support (`libayatana-appindicator3-1`, declared as a `.deb` dependency). If the tray is unavailable, Settings remains reachable from the dock/launcher because the app is single-instance.
- Startup geometry is deliberately not persisted: Chromium reports frameless transparent X11 windows a few pixels larger under fractional scaling, and saving that would compound on every launch.
- Fonts are bundled locally as WOFF2 (SIL Open Font License) and committed under `src/renderer/fonts/` with their license files. No webfonts are fetched at runtime.
- Icons are generated from code (`scripts/make-icons.mjs`, signed-distance shapes + a hand-rolled PNG encoder).
- `scripts/capture.mjs` screenshots every widget through the DevTools protocol — useful when windows are covered:

  ```bash
  ./node_modules/.bin/electron . --remote-debugging-port=9222
  node scripts/capture.mjs
  ```
