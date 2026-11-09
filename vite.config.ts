import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./src/renderer', import.meta.url));
const outDir = fileURLToPath(new URL('./dist/renderer', import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'chrome130',
    rollupOptions: {
      input: {
        widget: fileURLToPath(new URL('./src/renderer/widget.html', import.meta.url)),
        editor: fileURLToPath(new URL('./src/renderer/editor.html', import.meta.url)),
        settings: fileURLToPath(new URL('./src/renderer/settings.html', import.meta.url)),
        reminder: fileURLToPath(new URL('./src/renderer/reminder.html', import.meta.url)),
        dock: fileURLToPath(new URL('./src/renderer/dock.html', import.meta.url)),
        preview: fileURLToPath(new URL('./src/renderer/preview.html', import.meta.url)),
      },
    },
  },
});
