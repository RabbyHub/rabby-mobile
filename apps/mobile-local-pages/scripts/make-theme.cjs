#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const tinycolor2 = require('tinycolor2');

const { themeColorsNext2024 } = require('@rabby-wallet/base-utils');

const ROOT = path.resolve(__dirname, '..');
const rabbyCssPrefix = 'rabby-';

const SPACES = `  `;
const LINE_BREAK = '\n';

const SPECIAL_DEFAULT_ALPHA = {
  light: [],
  dark: [],
};

makeTailwindV3Theme: {
  const cssvarSrcContent = `
/* this file is genetared automatically, never modify it manually! */

:root {
  /* -------------------- base define -------------------- */
${['light', 'dark']
  .map(theme => {
    return Object.entries(themeColorsNext2024[theme])
      .map(([cssvarKey, colorValue]) => {
        const varcore = cssvarKey.replace(/^\-\-/, '');

        return `${SPACES}--rabby-${theme}-${varcore}: ${colorValue};`;
      })
      .join(LINE_BREAK);
  })
  .join(LINE_BREAK.repeat(2))}
}

${[
  {
    theme: 'light',
    parentSelector: ':root',
  },
  {
    theme: 'dark',
    parentSelector: 'html[data-theme=dark], body[data-theme=dark]',
  },
]
  .map(({ theme, parentSelector }) => {
    return `${parentSelector} {
${SPACES}/* -------------------- ${theme} mode -------------------- */
${Object.entries(themeColorsNext2024[theme])
  .map(([cssvarKey, colorValue]) => {
    const varcore = cssvarKey.replace(/^\-\-/, '');

    const tinyColor = tinycolor2(colorValue);
    const rgbs = tinyColor.toRgb();
    const alpha = tinyColor.getAlpha();
    if (alpha !== 1) {
      SPECIAL_DEFAULT_ALPHA[theme].push({ cssvarKey, alpha });
    }

    return [
      `${SPACES}--${rabbyCssPrefix}${cssvarKey}-rgb: ${rgbs.r}, ${rgbs.g}, ${rgbs.b};`,
      `${SPACES}--${rabbyCssPrefix}${cssvarKey}: var(--rabby-${theme}-${varcore});`,
    ]
      .filter(Boolean)
      .join(LINE_BREAK);
  })
  .join(LINE_BREAK)}
}
${
  !SPECIAL_DEFAULT_ALPHA[theme].length
    ? ''
    : SPECIAL_DEFAULT_ALPHA[theme]
        .map(({ cssvarKey, alpha }) => {
          return [
            //     `${isDarkTheme ? `.dark ` : ''} {
            // ${SPACES}--${rabbyCssPrefix}${cssvarKey}-opacity: ${alpha};
            // }`,
            //     `${isDarkTheme ? `.dark ` : ''}.bg-${rabbyCssPrefix}${cssvarKey} {
            // ${SPACES}--bg-${rabbyCssPrefix}${cssvarKey}-opacity: ${alpha};
            // }`,
          ]
            .filter(Boolean)
            .join(LINE_BREAK);
        })
        .filter(Boolean)
        .join(LINE_BREAK)
}`;
  })
  .join(LINE_BREAK)}
`;
  //   fs.writeFileSync(path.resolve(ROOT, 'src/styles/cssvars.css'), cssvarSrcContent, 'utf8');

  // console.log('[mobile-local-pages] make-theme css vars version success!');
}

// @see https://tailwindcss.com/docs/theme#why-theme-instead-of-root
makeTailwindV4Theme: {
  const themeContent = `
/* this file is genetared automatically, never modify it manually! */
@import 'tailwindcss';

@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

@theme {
  /* -------------------- theme define -------------------- */
${['light', 'dark']
  .map(theme => {
    return Object.entries(themeColorsNext2024[theme])
      .map(([cssvarKey, colorValue]) => {
        const varcore = cssvarKey.replace(/^\-\-/, '');

        return `${SPACES}--color-${theme}-${varcore}: ${colorValue};`;
      })
      .join(LINE_BREAK);
  })
  .join(LINE_BREAK.repeat(2))}
}

@theme {
${Object.entries(themeColorsNext2024.light)
  .map(([cssvarKey, colorValue]) => {
    const varcore = cssvarKey.replace(/^\-\-/, '');

    return `${SPACES}--color-${varcore}: ${colorValue};`;
  })
  .join(LINE_BREAK)}
}

@layer theme {
  :root, :host {
    @variant dark {
${Object.entries(themeColorsNext2024.dark)
  .map(([cssvarKey, colorValue]) => {
    const varcore = cssvarKey.replace(/^\-\-/, '');

    return `${SPACES.repeat(3)}--color-${varcore}: ${colorValue};`;
  })
  .join(LINE_BREAK)}
    }
  }
}
`;
  fs.writeFileSync(
    path.resolve(ROOT, 'src/styles/tailwind-theme-v4.css'),
    themeContent,
    'utf8',
  );

  console.log('[mobile-local-pages] make-theme theme vars success!');
}
