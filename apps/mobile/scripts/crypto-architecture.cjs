const path = require('path');

// QuickCrypto 1.x installs Base64 globals backed by a New-Architecture-only
// TurboModule. Keep the previously shipped pair for the legacy architecture;
// select both the JS implementation and its native modules at build time.
const getCryptoNativeDependencies = architecture => {
  const disabled = { platforms: { android: null, ios: null } };
  const legacy = architecture === 'legacy';
  return {
    'react-native-quick-crypto': legacy ? disabled : {},
    'react-native-quick-crypto-legacy': legacy ? {} : disabled,
    'react-native-quick-base64': legacy ? disabled : {},
    // Before the architecture migration Base64 v2 was transitive and not
    // autolinked. Preserve its base64-js fallback on oldArch rather than
    // introducing a second native implementation as part of this fix.
    'react-native-quick-base64-legacy': disabled,
  };
};

const resolveCryptoModule = (moduleName, { architecture, projectRoot }) => {
  const canonicalName =
    moduleName === 'crypto' ? 'react-native-quick-crypto' : moduleName;
  const packageName = [
    'react-native-quick-crypto',
    'react-native-quick-base64',
  ].find(
    name => canonicalName === name || canonicalName.startsWith(`${name}/`),
  );

  if (!packageName) {
    return undefined;
  }
  // Preserve transitive Base64 resolution in the existing new-architecture
  // stack. In legacy builds every consumer must avoid Base64 v3, including
  // Buffer and Node's `crypto` alias.
  if (
    architecture !== 'legacy' &&
    packageName === 'react-native-quick-base64'
  ) {
    return undefined;
  }

  const selectedPackage =
    architecture === 'legacy' ? `${packageName}-legacy` : packageName;
  const manifestPath = require.resolve(`${selectedPackage}/package.json`, {
    paths: [projectRoot],
  });
  const packageRoot = path.dirname(manifestPath);
  const subpath = canonicalName.slice(packageName.length + 1);
  // The legacy CryptoKey/export patch applies to lib/module, not src.
  const entry =
    subpath ||
    (packageName === 'react-native-quick-crypto'
      ? 'lib/module/index.js'
      : 'src/index.ts');

  return require.resolve(path.resolve(packageRoot, entry));
};

module.exports = { getCryptoNativeDependencies, resolveCryptoModule };
