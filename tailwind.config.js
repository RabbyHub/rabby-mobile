const mobileConfig = require('./apps/mobile/tailwind.config.js');
const mobileLocalPagesConfig = require('./apps/mobile-local-pages/tailwind.config.js');

// put here only for enable vscode tailwindcss extension
module.exports = {
  ...require('./apps/mobile/tailwind.config.js'),
  content: mobileLocalPagesConfig.content.map((p) => {
    // only help hints for vscode tailwindcss extension, not used in build
    return p.replace('./', './apps/mobile-local-pages/');
  }),
  theme: {
    ...mobileConfig.theme,
    colors: {
      ...mobileLocalPagesConfig.theme.colors,
      ...mobileConfig.theme.colors,
    },
  },
};
