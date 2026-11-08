import { app } from 'electron';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
const desktopFile = path.join(autostartDir, 'desktop-widgets.desktop');

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function launchCommand(): string {
  // Packaged builds run the binary directly; in dev we point at Electron + the project.
  if (app.isPackaged) return quote(process.execPath);
  return `${quote(process.execPath)} ${quote(app.getAppPath())}`;
}

export function applyAutostart(enabled: boolean): void {
  if (!enabled) {
    rmSync(desktopFile, { force: true });
    return;
  }

  mkdirSync(autostartDir, { recursive: true });
  writeFileSync(
    desktopFile,
    `[Desktop Entry]
Type=Application
Name=Desktop Widgets
Comment=Home screen widgets on the desktop
Exec=${launchCommand()}
Terminal=false
X-GNOME-Autostart-enabled=true
`,
  );
}
