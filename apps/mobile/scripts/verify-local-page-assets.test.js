const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ANDROID_BASE,
  verifyLocalPageAssets,
} = require('./verify-local-page-assets.cjs');

const CHART_HTML_PATH = 'pages/tradingview-candle-chart.html';
const CHART_BUNDLE = [
  'CHART_READY',
  'CANDLE_DATA_APPLIED',
  'REQUEST_OLDER_CANDLES',
  'PERPS_PRO_PRICE_SCALE_AUTO_SCALE_CHANGED',
  'candleDataAppliedAck',
  'perpsProKlineProtocolVersion',
].join(' ');

function writeFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function chartHtml({ base, script }) {
  return `<!doctype html><html><head><base href="${base}" /><script src="${script}"></script></head></html>`;
}

function createFixture(repoDir) {
  writeFile(
    repoDir,
    'apps/mobile/src/components2024/TradingViewCandleChart/index.tsx',
    'const PERPS_PRO_KLINE_PROTOCOL_VERSION = 1;',
  );
  writeFile(
    repoDir,
    'apps/mobile-local-pages/src/pages/tradingview-candle-chart/index.tsx',
    'const PERPS_PRO_KLINE_PROTOCOL_VERSION = 1;',
  );

  const androidRoot = path.join(
    repoDir,
    'apps/mobile/assets/android/builtin-pages',
  );
  const iosRoot = path.join(repoDir, 'apps/mobile/assets/ios/builtin-pages');
  const linkedAndroidRoot = path.join(
    repoDir,
    'apps/mobile/android/app/src/main/assets/custom/builtin-pages',
  );

  writeFile(
    androidRoot,
    CHART_HTML_PATH,
    chartHtml({
      base: ANDROID_BASE,
      script: `${ANDROID_BASE}assets/chart.js`,
    }),
  );
  writeFile(androidRoot, 'assets/chart.js', CHART_BUNDLE);
  writeFile(
    iosRoot,
    CHART_HTML_PATH,
    chartHtml({ base: './', script: '../assets/chart.js' }),
  );
  writeFile(iosRoot, 'assets/chart.js', CHART_BUNDLE);
  fs.mkdirSync(path.dirname(linkedAndroidRoot), { recursive: true });
  fs.cpSync(androidRoot, linkedAndroidRoot, { recursive: true });

  return { androidRoot, linkedAndroidRoot, repoDir };
}

describe('verify-local-page-assets', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rabby-local-pages-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it('accepts reachable platform resources with matching protocol versions', () => {
    const fixture = createFixture(fixtureRoot);

    expect(verifyLocalPageAssets(fixture.repoDir)).toEqual({
      protocolVersion: 1,
    });
  });

  it('rejects the root-relative Android resources produced by a development build', () => {
    const fixture = createFixture(fixtureRoot);
    writeFile(
      fixture.androidRoot,
      CHART_HTML_PATH,
      chartHtml({ base: '/', script: '/assets/chart.js' }),
    );

    expect(() => verifyLocalPageAssets(fixture.repoDir)).toThrow(
      'android chart base must be',
    );
  });

  it('rejects a native/local-page protocol version mismatch', () => {
    const fixture = createFixture(fixtureRoot);
    writeFile(
      fixture.repoDir,
      'apps/mobile-local-pages/src/pages/tradingview-candle-chart/index.tsx',
      'const PERPS_PRO_KLINE_PROTOCOL_VERSION = 2;',
    );

    expect(() => verifyLocalPageAssets(fixture.repoDir)).toThrow(
      'native v1, local page v2',
    );
  });

  it('rejects stale Android assets after native linking', () => {
    const fixture = createFixture(fixtureRoot);
    writeFile(
      fixture.linkedAndroidRoot,
      'assets/chart.js',
      `${CHART_BUNDLE} stale`,
    );

    expect(() => verifyLocalPageAssets(fixture.repoDir)).toThrow(
      'Linked Android built-in page is stale: assets/chart.js',
    );
  });
});
