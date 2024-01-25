const orig = require('./apps/mobile/tailwind.config.js');

// put here only for enable vscode tailwindcss extension

module.exports = {
  ...require('./apps/mobile/tailwind.config.js'),
  content: orig.content.map((p) => {
    return p.replace('./', './apps/mobile/');
  }),
};
