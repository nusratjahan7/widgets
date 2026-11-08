import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PRELOAD_PATH = path.join(MODULE_DIR, '..', 'preload', 'index.cjs');
export const RENDERER_DIR = path.join(MODULE_DIR, '..', 'renderer');
export const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
