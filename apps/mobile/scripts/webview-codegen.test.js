const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Tooling contract, not a WebView rendering test: execute the installed RN
// generator against the installed patched dependency, without mocking either.
describe('WebView iOS native registration', () => {
  it('registers the Fabric view and TurboModule from the installed package', () => {
    const libraryPath = path.dirname(
      require.resolve('react-native-webview/package.json'),
    );
    const packageJson = require(path.join(libraryPath, 'package.json'));
    expect(packageJson.codegenConfig.ios?.modulesProvider).toEqual({
      RNCWebViewModule: 'RNCWebViewModule',
    });

    const outputDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'rabby-webview-codegen-test-'),
    );
    try {
      const generator = require.resolve(
        'react-native/scripts/codegen/generate-artifacts-executor/generateRCTThirdPartyComponents',
      );
      execFileSync(
        process.execPath,
        [
          '-e',
          `const [generator, libraryPath, outputDir] = process.argv.slice(1);
           const config = require(libraryPath + '/package.json').codegenConfig;
           require(generator).generateRCTThirdPartyComponents(
             [{config, libraryPath}], outputDir);`,
          generator,
          libraryPath,
          outputDir,
        ],
        { timeout: 30000 },
      );
      const provider = fs.readFileSync(
        path.join(outputDir, 'RCTThirdPartyComponentsProvider.mm'),
        'utf8',
      );
      expect(provider).toContain(
        '@"RNCWebView": NSClassFromString(@"RNCWebView")',
      );
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
