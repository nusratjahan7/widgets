import { clipboard, nativeImage, type ClipboardItem } from 'electron';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { PANEL_LIMITS } from '../../shared/clipboard-panel/types.js';
import { sessionIsX11 } from '../x11.js';
import { hashBytes, hashText } from './hash.js';
import type { IncomingClipboard } from './history.js';

const run = promisify(execFile);

const POLL_MS = 500;
const SUPPRESS_MAX = 50;
const MARKER = '\n@@WIDGETS@@\n';
const STREAM_MAX = 16 * 1024 * 1024;

const WAYLAND_SCRIPT = [
  'types=$(wl-paste --list-types 2>/dev/null)',
  'printf "\\n@@WIDGETS@@\\n"',
  'if printf "%s\\n" "$types" | grep -qx "image/png"; then',
  '  printf "img:"; wl-paste --type image/png 2>/dev/null | base64 -w0',
  'else',
  '  printf "txt:"; wl-paste --no-newline --type text/plain 2>/dev/null',
  'fi',
  'printf "\\n@@WIDGETS@@\\n"',
].join('\n');

function isWaylandSession(): boolean {
  return process.platform === 'linux' && !sessionIsX11();
}

function isSensitiveFormat(format: string): boolean {
  const lower = format.toLowerCase();
  return lower.includes('passwordmanagerhint') || lower.includes('x-kde-password');
}

async function commandExists(name: string): Promise<boolean> {
  try {
    await run('sh', ['-c', `command -v ${name}`], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export class ClipboardWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private child: ChildProcess | null = null;
  private streamBuffer = '';
  private lastText = '';
  private lastImageHash = '';
  private suppressed = new Map<string, number>();
  private suppressImageUntil = 0;
  private seedPromise: Promise<void> | null = null;
  private polling = false;
  private active = false;
  private stopping = false;
  private readonly onContent: (content: IncomingClipboard) => void;
  private readonly onError?: (message: string) => void;

  constructor(onContent: (content: IncomingClipboard) => void, onError?: (message: string) => void) {
    this.onContent = onContent;
    this.onError = onError;
  }

  get running(): boolean {
    return this.active;
  }

  /** Ignores the panel's own clipboard write for a short window. */
  suppress(hash: string): void {
    if (!hash) return;
    this.suppressed.set(hash, Date.now());
    if (this.suppressed.size > SUPPRESS_MAX) {
      const first = this.suppressed.keys().next().value;
      if (first) this.suppressed.delete(first);
    }
  }

  private isSuppressed(hash: string): boolean {
    const at = this.suppressed.get(hash);
    if (at === undefined) return false;
    this.suppressed.delete(hash);
    return Date.now() - at < 3000;
  }

  /** Ignores the next image read; Chromium may re-encode the PNG on write. */
  suppressImage(windowMs = 1500): void {
    this.suppressImageUntil = Date.now() + windowMs;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.stopping = false;
    this.seedPromise = this.seed();
    if (isWaylandSession()) void this.startWayland();
    else this.startPoll();
  }

  stop(): void {
    this.active = false;
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.child) {
      this.child.removeAllListeners();
      this.child.kill();
      this.child = null;
    }
    this.streamBuffer = '';
  }

  /** Remembers the current clipboard so pre-existing content is not recorded. */
  private async seed(): Promise<void> {
    try {
      const items = await clipboard.read();
      if (items.some((item) => item.types.some(isSensitiveFormat))) return;

      const text = await clipboard.readText();
      if (text) this.lastText = text;

      const png = await this.readPng(items);
      if (png) this.lastImageHash = hashBytes(png);
    } catch {
      // Clipboard may not be ready yet; the poll loop will settle it.
    }
  }

  private startPoll(): void {
    if (this.timer || !this.active) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), POLL_MS);
  }

  private async poll(): Promise<void> {
    if (this.polling || !this.active || this.stopping) return;
    this.polling = true;

    try {
      if (this.seedPromise) {
        await this.seedPromise;
        this.seedPromise = null;
      }

      const items = await clipboard.read();
      if (items.some((item) => item.types.some(isSensitiveFormat))) return;

      const text = await clipboard.readText();
      if (text && text !== this.lastText) {
        this.emit({ kind: 'text', text });
        return;
      }

      const png = await this.readPng(items);
      if (!png || png.length === 0) return;

      const hash = hashBytes(png);
      if (hash === this.lastImageHash) return;
      this.emit({ kind: 'image', png });
    } catch {
      // The clipboard can be momentarily unavailable during rapid copies.
    } finally {
      this.polling = false;
    }
  }

  private async readPng(items: ClipboardItem[]): Promise<Buffer | null> {
    for (const item of items) {
      const type =
        item.types.find((candidate) => candidate.startsWith('image/png')) ??
        item.types.find((candidate) => candidate.startsWith('image/jpeg')) ??
        item.types.find((candidate) => candidate.startsWith('image/webp'));
      if (!type) continue;

      const value = await item.getType(type);
      if (typeof (value as Blob).arrayBuffer !== 'function') continue;

      const bytes = Buffer.from(await (value as Blob).arrayBuffer());
      if (type.startsWith('image/png')) return bytes;

      const converted = nativeImage.createFromBuffer(bytes).toPNG();
      if (converted.length > 0) return converted;
    }
    return null;
  }

  private async startWayland(): Promise<void> {
    const available = await commandExists('wl-paste');
    if (!available || !this.active) {
      this.onError?.('wl-paste not found — falling back to clipboard polling');
      this.startPoll();
      return;
    }

    await this.seedWayland();
    if (!this.active) return;

    let child: ChildProcess;
    try {
      child = spawn('wl-paste', ['--watch', 'sh', '-c', WAYLAND_SCRIPT], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      this.onError?.(`could not start wl-paste: ${String(error)}`);
      this.startPoll();
      return;
    }

    this.child = child;
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => this.consume(chunk));
    child.stderr?.on('data', () => {
      // wl-paste is noisy when the selection has no text target; ignore.
    });
    child.on('error', (error) => {
      this.onError?.(`wl-paste failed: ${String(error)}`);
      this.child = null;
      if (this.active && !this.stopping) this.startPoll();
    });
    child.on('exit', () => {
      this.child = null;
      if (this.active && !this.stopping) {
        this.onError?.('wl-paste exited — falling back to clipboard polling');
        this.startPoll();
      }
    });

    // Electron's clipboard still works on XWayland; keep a slow poll as a safety
    // net for selections the watcher misses.
    this.startPoll();
  }

  private async seedWayland(): Promise<void> {
    try {
      const { stdout: types } = await run('wl-paste', ['--list-types'], { timeout: 2000 });
      if (types.split('\n').includes('image/png')) {
        const png = await new Promise<Buffer>((resolve, reject) => {
          execFile(
            'wl-paste',
            ['--type', 'image/png'],
            { timeout: 2000, encoding: 'buffer', maxBuffer: PANEL_LIMITS.imageBytes * 2 },
            (error, out) => {
              if (error) reject(error);
              else resolve(out);
            },
          );
        });
        if (png.length > 0) this.lastImageHash = hashBytes(png);
        return;
      }

      const { stdout } = await run('wl-paste', ['--no-newline', '--type', 'text/plain'], {
        timeout: 2000,
      });
      if (typeof stdout === 'string' && stdout) this.lastText = stdout;
    } catch {
      // No current selection or wl-paste refused; nothing to seed.
    }
  }

  private consume(chunk: string): void {
    this.streamBuffer += chunk;

    let open = this.streamBuffer.indexOf(MARKER);
    while (open !== -1) {
      const payloadStart = open + MARKER.length;
      const close = this.streamBuffer.indexOf(MARKER, payloadStart);
      if (close === -1) break;

      const payload = this.streamBuffer.slice(payloadStart, close);
      this.streamBuffer = this.streamBuffer.slice(close + MARKER.length);
      this.handlePayload(payload);
      open = this.streamBuffer.indexOf(MARKER);
    }

    if (this.streamBuffer.length > STREAM_MAX) this.streamBuffer = '';
  }

  private handlePayload(payload: string): void {
    if (payload.startsWith('txt:')) {
      this.emit({ kind: 'text', text: payload.slice(4) });
      return;
    }
    if (payload.startsWith('img:')) {
      const png = Buffer.from(payload.slice(4), 'base64');
      if (png.length > 0) this.emit({ kind: 'image', png });
    }
  }

  private emit(content: IncomingClipboard): void {
    if (content.kind === 'text') {
      const text = content.text.slice(0, PANEL_LIMITS.text);
      if (!text.trim()) return;

      const hash = hashText(text);
      if (this.isSuppressed(hash)) {
        this.lastText = text;
        this.lastImageHash = '';
        return;
      }
      // The Wayland watcher can emit the current selection on start.
      if (text === this.lastText) return;

      this.lastText = text;
      this.lastImageHash = '';
      this.onContent({ kind: 'text', text });
      return;
    }

    if (content.png.length === 0 || content.png.length > PANEL_LIMITS.imageBytes) return;

    const hash = hashBytes(content.png);
    if (this.isSuppressed(hash)) {
      this.lastImageHash = hash;
      this.lastText = '';
      return;
    }
    if (hash === this.lastImageHash) return;

    this.lastImageHash = hash;
    this.lastText = '';
    if (Date.now() < this.suppressImageUntil) return;

    this.onContent(content);
  }
}
