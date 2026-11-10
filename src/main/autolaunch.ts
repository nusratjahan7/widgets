import { app } from 'electron';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const AUTOSTART_HIDDEN_FLAG = '--hidden';

const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
const desktopFile = path.join(autostartDir, 'desktop-widgets.desktop');

/**
 * Quotes one Exec argument. The Desktop Entry spec treats `"`, `` ` ``, `$`
 * and `\` as reserved inside quoted arguments, and `%` as a field-code prefix.
 */
function quote(value: string): string {
  const escaped = value.replace(/(["`$\\])/g, '\\$1').replace(/%/g, '%%');
  return `"${escaped}"`;
}

function launchCommand(): string {
  // An AppImage runs from a temporary squashfs mount, so process.execPath points
  // at a directory that disappears after shutdown. APPIMAGE is the real file.
  if (process.env.APPIMAGE) return quote(process.env.APPIMAGE);
  if (app.isPackaged) return quote(process.execPath);
  return `${quote(process.execPath)} ${quote(app.getAppPath())}`;
}

export function isAutostartEnabled(): boolean {
  return existsSync(desktopFile);
}

/** Writes or removes the XDG autostart entry. Returns false when the write failed. */
export function applyAutostart(enabled: boolean): boolean {
  try {
    if (!enabled) {
      rmSync(desktopFile, { force: true });
      return true;
    }

    mkdirSync(autostartDir, { recursive: true });
    writeFileSync(
      desktopFile,
      `[Desktop Entry]
Type=Application
Name=Desktop Widgets
Comment=Home screen widgets on the desktop
Exec=${launchCommand()} ${AUTOSTART_HIDDEN_FLAG}
Icon=desktop-widgets
StartupWMClass=desktop-widgets
Terminal=false
X-GNOME-Autostart-enabled=true
X-GNOME-Autostart-Delay=5
`,
    );
    return true;
  } catch (error) {
    console.warn('[autostart] could not update the autostart entry:', error);
    return false;
  }
}
