#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_DIR = path.resolve(__dirname, '../../..');
const CHART_HTML_PATH = 'pages/tradingview-candle-chart.html';
const ANDROID_BASE = 'file:///android_asset/custom/builtin-pages/';
const REQUIRED_CHART_CAPABILITIES = [
  'CANDLE_DATA_APPLIED',
  'CHART_READY',
  'REQUEST_OLDER_CANDLES',
  'candleDataAppliedAck',
  'perpsProKlineProtocolVersion',
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readProtocolVersion(source, label) {
  const match = source.match(
    /const\s+PERPS_PRO_KLINE_PROTOCOL_VERSION\s*=\s*(\d+)\s*;/u,
  );
  invariant(
    match,
    `${label} does not declare PERPS_PRO_KLINE_PROTOCOL_VERSION`,
  );
  return Number.parseInt(match[1], 10);
}

function extractResourceUrls(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/gu, '');
  const urls = [];
  const tagPattern =
    /<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/giu;
  let match;
  while ((match = tagPattern.exec(withoutComments))) {
    urls.push(match[1]);
  }
  return urls;
}

function stripUrlSuffix(url) {
  return url.split(/[?#]/u, 1)[0];
}

function assertPathInsideRoot(root, target, resourceUrl) {
  const relativePath = path.relative(root, target);
  invariant(
    relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath),
    `Local-page resource escapes its asset root: ${resourceUrl}`,
  );
}

function resolveResourcePath({ htmlPath, platform, resourceUrl, root }) {
  const cleanUrl = stripUrlSuffix(resourceUrl);
  let target;

  if (platform === 'android') {
    invariant(
      cleanUrl.startsWith(ANDROID_BASE),
      `Android local-page resource must use ${ANDROID_BASE}, received ${resourceUrl}`,
    );
    target = path.resolve(root, cleanUrl.slice(ANDROID_BASE.length));
  } else {
    invariant(
      !cleanUrl.startsWith('/') && !/^[a-z][a-z\d+.-]*:/iu.test(cleanUrl),
      `iOS local-page resource must be relative, received ${resourceUrl}`,
    );
    target = path.resolve(path.dirname(htmlPath), cleanUrl);
  }

  assertPathInsideRoot(root, target, resourceUrl);
  return target;
}

function validateChartAssets({ platform, root }) {
  const htmlPath = path.join(root, CHART_HTML_PATH);
  invariant(fs.existsSync(htmlPath), `Missing local-page HTML: ${htmlPath}`);

  const html = fs.readFileSync(htmlPath, 'utf8');
  const baseMatch = html.match(/<base\s+href=["']([^"']+)["']/iu);
  const expectedBase = platform === 'android' ? ANDROID_BASE : './';
  invariant(
    baseMatch?.[1] === expectedBase,
    `${platform} chart base must be ${expectedBase}, received ${
      baseMatch?.[1] || '<missing>'
    } in ${htmlPath}`,
  );

  const resourceUrls = extractResourceUrls(html);
  invariant(
    resourceUrls.length > 0,
    `No chart resources referenced by ${htmlPath}`,
  );

  const javascript = [];
  for (const resourceUrl of resourceUrls) {
    const resourcePath = resolveResourcePath({
      htmlPath,
      platform,
      resourceUrl,
      root,
    });
    invariant(
      fs.existsSync(resourcePath) && fs.statSync(resourcePath).size > 0,
      `Missing local-page resource referenced by ${htmlPath}: ${resourceUrl}`,
    );
    if (resourcePath.endsWith('.js')) {
      javascript.push(fs.readFileSync(resourcePath, 'utf8'));
    }
  }

  const chartBundle = javascript.join('\n');
  for (const capability of REQUIRED_CHART_CAPABILITIES) {
    invariant(
      chartBundle.includes(capability),
      `${platform} chart bundle is missing capability ${capability}`,
    );
  }
}

function listFiles(root, current = root) {
  invariant(
    fs.existsSync(current),
    `Missing local-page asset directory: ${current}`,
  );
  const files = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(root, absolutePath));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolutePath));
    }
  }
  return files.sort();
}

function digestFile(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function assertDirectoriesEqual(sourceRoot, linkedRoot) {
  const sourceFiles = listFiles(sourceRoot);
  const linkedFiles = listFiles(linkedRoot);
  invariant(
    JSON.stringify(sourceFiles) === JSON.stringify(linkedFiles),
    'Linked Android built-in page file list does not match generated assets',
  );

  for (const relativePath of sourceFiles) {
    invariant(
      digestFile(path.join(sourceRoot, relativePath)) ===
        digestFile(path.join(linkedRoot, relativePath)),
      `Linked Android built-in page is stale: ${relativePath}`,
    );
  }
}

function verifyLocalPageAssets(repoDir = REPO_DIR) {
  const nativeProtocolSource = fs.readFileSync(
    path.join(
      repoDir,
      'apps/mobile/src/components2024/TradingViewCandleChart/index.tsx',
    ),
    'utf8',
  );
  const localPageProtocolSource = fs.readFileSync(
    path.join(
      repoDir,
      'apps/mobile-local-pages/src/pages/tradingview-candle-chart/index.tsx',
    ),
    'utf8',
  );
  const nativeProtocolVersion = readProtocolVersion(
    nativeProtocolSource,
    'Native chart bridge',
  );
  const localPageProtocolVersion = readProtocolVersion(
    localPageProtocolSource,
    'Local chart page',
  );
  invariant(
    nativeProtocolVersion === localPageProtocolVersion,
    `Perps Pro K-line protocol mismatch: native v${nativeProtocolVersion}, local page v${localPageProtocolVersion}`,
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

  validateChartAssets({ platform: 'android', root: androidRoot });
  validateChartAssets({ platform: 'ios', root: iosRoot });
  validateChartAssets({ platform: 'android', root: linkedAndroidRoot });
  assertDirectoriesEqual(androidRoot, linkedAndroidRoot);

  return { protocolVersion: nativeProtocolVersion };
}

if (require.main === module) {
  try {
    const result = verifyLocalPageAssets();
    console.log(
      `[verify:local-pages] Android/iOS chart resources and Perps Pro protocol v${result.protocolVersion} are current`,
    );
  } catch (error) {
    console.error(`[verify:local-pages] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  ANDROID_BASE,
  assertDirectoriesEqual,
  extractResourceUrls,
  readProtocolVersion,
  resolveResourcePath,
  validateChartAssets,
  verifyLocalPageAssets,
};
