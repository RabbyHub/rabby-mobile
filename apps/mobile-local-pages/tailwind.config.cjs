const { themeColorsNext2024 } = require('@rabby-wallet/base-utils');

const next2024Colors = ['light', 'dark'].reduce(
  (accu, theme) => {
    Object.entries(themeColorsNext2024[theme]).forEach(
      ([cssvarKey, colorValue]) => {
        if (!accu.auto[cssvarKey]) {
          accu.auto[cssvarKey] = colorValue;
        }

        accu[theme][cssvarKey] = colorValue;
      },
    );

    return accu;
  },
  {
    light: {},
    dark: {},
    auto: {},
  },
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.js', './src/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    spacing: [
      0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 60, 80,
    ].reduce((m, n) => {
      m[n] = n;
      return m;
    }, {}),
    screens: {},
    colors: {
      ['color']: next2024Colors.auto,
      ['light']: next2024Colors.light,
      ['dark']: next2024Colors.dark,
    },
    fontSize: {},
    extend: {
      colors: {},
    },
  },
  plugins: [],
};
