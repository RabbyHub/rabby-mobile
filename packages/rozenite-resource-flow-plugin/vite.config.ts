import tailwindcss from '@tailwindcss/vite';
import { rozenitePlugin } from '@rozenite/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  plugins: [tailwindcss(), rozenitePlugin()],
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: false,
    reportCompressedSize: false,
    minify: true,
    sourcemap: false,
  },
});
