import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  defineConfig,
  type PluginOption,
} from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

const isDeployBuild = process.env.NODE_ENV === 'production';

const RABBY_GO_ENV = process.env.RABBY_GO_ENV || 'mobile-debug';
const RABBY_GO_RPOD_BASE = RABBY_GO_ENV === 'mobile-production' ? 'mobile' : RABBY_GO_ENV;

const renameHtmlPlugin: () => PluginOption = () => {
  return {
    name: 'rename-index-html',
    enforce: 'post', // Ensure this runs after other plugins
    generateBundle(_, bundle) {
      const allHtmls = Object.keys(bundle).filter(x => x.endsWith('.html'));

      allHtmls.forEach((htmlFile) => {
        if (bundle[htmlFile]) {
          bundle[htmlFile].fileName = basename(htmlFile);
        }
      });
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    renameHtmlPlugin(),
  ],
  base: '/',
  ...isDeployBuild && { base: `/${RABBY_GO_RPOD_BASE}/`},
  mode: RABBY_GO_ENV,
  build: {
    target: 'chrome79',
    outDir: resolve(__dirname, `dist/${RABBY_GO_RPOD_BASE}`),
    // assetsDir: `${RABBY_GO_ENV}/assets`,
    rollupOptions: {
      input: {
        ...RABBY_GO_ENV === 'mobile-debug' && {
          mainDebug: resolve(__dirname, 'mobile-debug/index.html'),
          testLink: resolve(__dirname, 'mobile-debug/test-link.html'),
        },
        ...RABBY_GO_ENV === 'mobile-regression' && {
          mainRegression: resolve(__dirname, 'mobile-regression/index.html'),
          testLink: resolve(__dirname, 'mobile-debug/test-link.html'),
        },
        ...RABBY_GO_ENV === 'mobile-production' && {
          mainProduction: resolve(__dirname, 'mobile/index.html'),
        },
      },
      output: {

      }
    }
  }
})
