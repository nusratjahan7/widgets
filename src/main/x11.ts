/**
 * True when the app runs on a plain X11 session. The clipboard panel uses this
 * to pick X11 paste tools; Wayland needs a different helper.
 */
export function sessionIsX11(): boolean {
  if (process.platform !== 'linux') return false;
  const session = (process.env.XDG_SESSION_TYPE ?? '').toLowerCase();
  if (session === 'wayland') return false;
  if (session === 'x11') return true;
  return Boolean(process.env.DISPLAY) && !process.env.WAYLAND_DISPLAY;
}
