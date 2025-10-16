const mobileConfig = require('../mobile/tailwind.config');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...mobileConfig,
  content: ['./index.js', './src/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    ...mobileConfig.theme,
    colors: {
      // ...mobileConfig.theme.colors,

      ['color']: next2024Colors.auto,
      ['light']: next2024Colors.light,
      ['dark']: next2024Colors.dark,
    },
  },
  plugins: [],
};
