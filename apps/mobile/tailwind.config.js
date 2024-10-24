// const colors = require('tailwindcss/colors');
const tinycolor2 = require('tinycolor2');

const { themeColors, rabbyCssPrefix } = require('./src/constant/theme-colors');

const rabbyColors = ['light', 'dark'].reduce(
  (accu, theme) => {
    Object.entries(themeColors[theme]).forEach(([cssvarKey, colorValue]) => {
      const tinyColor = tinycolor2(colorValue);
      const alpha = tinyColor.getAlpha();

      const hexValue = alpha
        ? tinyColor.toHexString()
        : tinyColor.toHex8String();

      if (!accu.auto[cssvarKey]) {
        accu.auto[cssvarKey] = colorValue;
        // const rgb = tinyColor.toRgb();
        // accu.auto[cssvarKey] = `rgb(var(--${rabbyCssPrefix}-${cssvarKey}) / <alpha-value>)`;
        // accu.rootBase.push(`--${rabbyCssPrefix}-${cssvarKey}: ${rgb.r} ${rgb.g} ${rgb.b}`);
      }

      accu[theme][cssvarKey] = hexValue;
    });

    return accu;
  },
  {
    light: {},
    dark: {},
    auto: {},
    // rootBase: [],
  },
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.js',
    './src/*.{js,jsx,ts,tsx,html}',
    './src/components/**/*.{js,jsx,ts,tsx,html}',
    './src/hooks/**/*.{js,jsx,ts,tsx,html}',
    './src/screens/**/*.{js,jsx,ts,tsx,html}',
    './src/utils/**/*.{js,jsx,ts,tsx,html}',
  ],
  theme: {
    spacing: [
      0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 60, 80,
    ].reduce((m, n) => {
      // m[n] = `${n}px`;
      m[n] = n;
      return m;
    }, {}),
    screens: {},
    colors: {
      [`${rabbyCssPrefix.replace(/\-$/, '')}`]: rabbyColors.auto,
      [`${'rabby-'.replace(/\-$/, '')}`]: rabbyColors.auto,

      ['light']: rabbyColors.light,
      ['dark']: rabbyColors.dark,
    },
    fontSize: {},
    /** @notice configuration here would override the default config above */
    extend: {
      colors: {},
    },
  },
  plugins: [],
};
