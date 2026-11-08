// Dev helper: screenshot every widget window through the DevTools protocol.
// Usage: electron . --remote-debugging-port=9222  then  node scripts/capture.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const port = process.argv[2] ?? '9222';
const outDir = process.argv[3] ?? 'captures';

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const pages = targets.filter(
  (target) => target.type === 'page' && (target.url.includes('widget=') || target.url.includes('editor.html')),
);

if (pages.length === 0) {
  console.error('No widget windows found. Is the app running with --remote-debugging-port?');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const page of pages) {
  const id =
    new URL(page.url).searchParams.get('widget') ??
    (page.url.includes('editor.html') ? 'cityEditor' : page.id);
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const result = await new Promise((resolve, reject) => {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id === 1) {
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
    socket.send(JSON.stringify({
      id: 1,
      method: 'Page.captureScreenshot',
      params: { format: 'png', fromSurface: true, captureBeyondViewport: false },
    }));
  });

  socket.close();
  writeFileSync(path.join(outDir, `${id}.png`), Buffer.from(result.data, 'base64'));
  console.log(`captured ${id} -> ${path.join(outDir, `${id}.png`)}`);
}
