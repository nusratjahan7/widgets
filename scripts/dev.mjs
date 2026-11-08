// Dev runner: Vite dev server + compiled main process, with restarts on
// main/preload changes. No extra tooling dependencies.
import { spawn, execFileSync } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import electronPath from 'electron';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(projectRoot, 'node_modules', '.bin', 'tsc');

let child = null;
let viteServer = null;
let restartTimer = null;
let shuttingDown = false;

function compileMain() {
  execFileSync(tsc, ['-p', 'tsconfig.main.json'], { cwd: projectRoot, stdio: 'inherit' });
}

function startElectron(url) {
  child = spawn(electronPath, ['.'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_DEV_SERVER_URL: url, NODE_ENV: 'development' },
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (shuttingDown) return;
    // Electron quit from the tray: stop the dev server with it.
    console.log(`\n[electron] exited (${code ?? 'signal'}) — stopping dev server`);
    void shutdown(0);
  });
}

function restartElectron(url) {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log('\n[dev] main process changed — restarting Electron');
    if (child) {
      const previous = child;
      child = null;
      previous.removeAllListeners('exit');
      previous.kill();
    }
    startElectron(url);
  }, 150);
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (child) child.kill();
  await viteServer?.close();
  process.exit(code);
}

viteServer = await createServer({ configFile: path.join(projectRoot, 'vite.config.ts') });
await viteServer.listen();

const url = viteServer.resolvedUrls?.local[0]?.replace(/\/$/, '');
if (!url) throw new Error('Vite did not report a local URL');

console.log(`\n[dev] renderer at ${url}`);

compileMain();
startElectron(url);

let rebuildTimer = null;
watch(path.join(projectRoot, 'src', 'main'), { recursive: true }, scheduleRebuild);
watch(path.join(projectRoot, 'src', 'preload'), { recursive: true }, scheduleRebuild);
watch(path.join(projectRoot, 'src', 'shared'), { recursive: true }, scheduleRebuild);

function scheduleRebuild() {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    try {
      compileMain();
      restartElectron(url);
    } catch {
      console.error('[dev] main build failed — keeping the previous build running');
    }
  }, 200);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => void shutdown(0));
}
