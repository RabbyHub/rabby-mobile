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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            /node_modules\/(antd|@ant-design|rc-|@rc-component)\//.test(id)
          ) {
            return 'lib-antd';
          }

          if (
            /node_modules\/(react|react-dom|react-native|react-native-web|scheduler)\//.test(
              id,
            )
          ) {
            return 'lib-react';
          }

          if (id.includes('@rozenite/plugin-bridge')) {
            return 'lib-bridge';
          }

          return 'lib-vendor';
        },
      },
    },
  },
});
