// const colors = require('tailwindcss/colors');
const tinycolor2 = require('tinycolor2');

const { themeColors, themeColors2 } = require('./src/constant/theme-colors');

const [classicalColors, next2024Colors] = [themeColors, themeColors2].map(
  palette => {
    const rabbyColors = ['light', 'dark'].reduce(
      (accu, theme) => {
        Object.entries(palette[theme]).forEach(([cssvarKey, colorValue]) => {
          const tinyColor = tinycolor2(colorValue);
          const alpha = tinyColor.getAlpha();

          const hexValue = alpha
            ? tinyColor.toHexString()
            : tinyColor.toHex8String();

          if (!accu.auto[cssvarKey]) {
            accu.auto[cssvarKey] = colorValue;
            // const rgb = tinyColor.toRgb();
            // accu.auto[cssvarKey] = `rgb(var(--r-${cssvarKey}) / <alpha-value>)`;
            // accu.rootBase.push(`--r-${cssvarKey}: ${rgb.r} ${rgb.g} ${rgb.b}`);
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

    return rabbyColors;
  },
);

console.log('[feat] classicalColors', classicalColors);

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
      [`${'r-'.replace(/\-$/, '')}`]: classicalColors.auto,
      [`${'rabby-'.replace(/\-$/, '')}`]: classicalColors.auto,
      [`${'r2-'.replace(/\-$/, '')}`]: next2024Colors.auto,

      ['light']: classicalColors.light,
      ['dark']: classicalColors.dark,
    },
    fontSize: {},
    /** @notice configuration here would override the default config above */
    extend: {
      colors: {},
    },
  },
  plugins: [],
};
