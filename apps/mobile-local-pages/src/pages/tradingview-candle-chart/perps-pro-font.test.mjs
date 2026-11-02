import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPerpsProFontFaceCss,
  PERPS_PRO_FONT_FACE_FAMILY,
  resolvePerpsProFontAssetUrls,
  resolvePerpsProFontFamily,
} from './perps-pro-font.ts';

test('does not request bundled Apple font files from an iOS MainBundle path', () => {
  assert.equal(
    resolvePerpsProFontAssetUrls({
      platform: 'ios',
      runtimeBaseUrl: '/private/App/RabbyMobile.app/',
    }),
    null,
  );
});

test('does not request bundled Apple font files from an iOS file URL', () => {
  assert.equal(
    resolvePerpsProFontAssetUrls({
      platform: 'ios',
      runtimeBaseUrl: 'file:///private/App/RabbyMobile.app/',
    }),
    null,
  );
});

test('uses the system rounded family on iOS without a bundled family alias', () => {
  const family = resolvePerpsProFontFamily({ platform: 'ios' });
  assert.equal(
    family,
    'ui-rounded, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  );
  assert.doesNotMatch(family, /Rabby SF Pro Rounded|SF Pro Rounded/);
});

test('preserves the Android asset family and its fallback ordering', () => {
  const family = resolvePerpsProFontFamily({ platform: 'android' });
  assert.equal(
    family,
    '"Rabby SF Pro Rounded", "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  );
  assert.doesNotMatch(family, /ui-rounded/);
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
