import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootProject = resolve(__dirname, '../..');
const mobileRoot = resolve(rootProject, 'apps/mobile');

const rets = { mode: 'production', platform: process.env.PLATFORM || 'android' };
process.argv.forEach((val, index) => {
  if (val === '--mode' && process.argv.length > index + 1) {
    rets.mode = process.argv[index + 1];
  }
  if (val === '--platform' && process.argv.length > index + 1) {
    rets.mode = process.argv[index + 1];
  }
});

const isProduction = process.env.NODE_ENV === 'production';

// https://vite.dev/config/
export default defineConfig({
  define: {
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  ...isProduction && {
    // base: `./`,
    base: rets.mode === 'android' ? `file:///android_asset/custom/builtin-pages/` : `./`,
  },
  build: {
    target: 'chrome79',
    emptyOutDir: true,
    // outDir: resolve(mobileRoot, `assets/custom/builtin-pages`),
    outDir: resolve(mobileRoot, `assets/${rets.mode}/builtin-pages`),
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'pages/index.html'),
        chartDemo: resolve(__dirname, 'pages/chart-demo.html'),
      },
    },
  }
})
