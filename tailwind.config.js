const mobileLocalPagesConfig = require('./apps/mobile-local-pages/tailwind.config.cjs');

// put here only for enable vscode tailwindcss extension
module.exports = {
  ...mobileLocalPagesConfig,
  content: mobileLocalPagesConfig.content.map((p) => {
    // only help hints for vscode tailwindcss extension, not used in build
    return p.replace('./', './apps/mobile-local-pages/');
  }),
};
