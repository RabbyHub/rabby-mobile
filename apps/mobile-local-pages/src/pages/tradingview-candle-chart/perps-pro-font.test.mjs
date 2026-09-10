import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPerpsProFontFaceCss,
  PERPS_PRO_FONT_FACE_FAMILY,
  resolvePerpsProFontAssetUrls,
} from './perps-pro-font.ts';

test('resolves the existing iOS MainBundle path as local font assets', () => {
  assert.deepEqual(
    resolvePerpsProFontAssetUrls({
      platform: 'ios',
      runtimeBaseUrl: '/private/App/RabbyMobile.app/',
    }),
    {
      regular: 'file:///private/App/RabbyMobile.app/SF-Pro-Rounded-Regular.otf',
      medium: 'file:///private/App/RabbyMobile.app/SF-Pro-Rounded-Medium.otf',
      bold: 'file:///private/App/RabbyMobile.app/SF-Pro-Rounded-Bold.otf',
    },
  );
});

test('keeps an iOS file URL usable when runtime info already includes it', () => {
  assert.deepEqual(
    resolvePerpsProFontAssetUrls({
      platform: 'ios',
      runtimeBaseUrl: 'file:///private/App/RabbyMobile.app/',
    }),
    {
      regular: 'file:///private/App/RabbyMobile.app/SF-Pro-Rounded-Regular.otf',
      medium: 'file:///private/App/RabbyMobile.app/SF-Pro-Rounded-Medium.otf',
      bold: 'file:///private/App/RabbyMobile.app/SF-Pro-Rounded-Bold.otf',
    },
  );
});

test('resolves the existing Android sibling font assets', () => {
  assert.deepEqual(
    resolvePerpsProFontAssetUrls({
      platform: 'android',
      runtimeBaseUrl: 'file:///android_asset/custom/',
    }),
    {
      regular: 'file:///android_asset/fonts/SF-Pro-Rounded-Regular.otf',
      medium: 'file:///android_asset/fonts/SF-Pro-Rounded-Medium.otf',
      bold: 'file:///android_asset/fonts/SF-Pro-Rounded-Bold.otf',
    },
  );
});

test('does not invent packaged font URLs for an HTTP development page', () => {
  assert.equal(
    resolvePerpsProFontAssetUrls({
      platform: 'android',
      runtimeBaseUrl: 'http://127.0.0.1:5173/pages/',
    }),
    null,
  );
});

test('defines regular, medium, and bold faces under one private family alias', () => {
  const css = createPerpsProFontFaceCss({
    regular: 'file:///Regular.otf',
    medium: 'file:///Medium.otf',
    bold: 'file:///Bold.otf',
  });

  assert.equal(css.match(/@font-face/g)?.length, 3);
  assert.equal(
    css.match(new RegExp(`font-family: "${PERPS_PRO_FONT_FACE_FAMILY}"`, 'g'))
      ?.length,
    3,
  );
  assert.match(css, /Regular\.otf[\s\S]*font-weight: 400/);
  assert.match(css, /Medium\.otf[\s\S]*font-weight: 500/);
  assert.match(css, /Bold\.otf[\s\S]*font-weight: 700/);
});

test('does not invent an asset URL before runtime info is available', () => {
  assert.equal(
    resolvePerpsProFontAssetUrls({
      platform: 'ios',
      runtimeBaseUrl: '',
    }),
    null,
  );
});
