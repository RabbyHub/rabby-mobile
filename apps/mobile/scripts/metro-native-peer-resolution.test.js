const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const peerSpecifiers = [
  'react-native-reanimated',
  'react-native-reanimated/src/hook/useAnimatedRef',
  'react-native-gesture-handler',
  'react-native-gesture-handler/src/components/GestureHandlerRootView',
];

describe('Metro app-owned native peers', () => {
  let snapshot;

  beforeAll(() => {
    // Load the real configuration outside Jest's native-module mocks. The
    // resolver uses the real filesystem, without starting Metro or Hermes.
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const Resolver = require('metro-resolver');
        const createContext = require('metro-resolver/private/createDefaultContext');
        const config = require('./metro.config.js');
        const root = process.cwd();
        const issuerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rabby-metro-peers-'));
        const lookup = filePath => {
          const stat = fs.statSync(filePath, { throwIfNoEntry: false });
          return stat ? {
            exists: true, type: stat.isDirectory() ? 'd' : 'f',
            realPath: fs.realpathSync(filePath),
          } : { exists: false };
        };
        const getPackage = filePath => fs.existsSync(filePath)
          ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
        const getPackageForModule = filePath => {
          let directory = path.dirname(filePath);
          while (path.basename(directory) !== 'node_modules') {
            const packageJson = getPackage(path.join(directory, 'package.json'));
            if (packageJson) return {
              rootPath: directory, packageJson,
              packageRelativePath: path.relative(directory, filePath),
            };
            const parent = path.dirname(directory);
            if (parent === directory) break;
            directory = parent;
          }
          return null;
        };
        const context = originModulePath => createContext({
          allowHaste: false,
          assetExts: new Set(config.resolver.assetExts),
          customResolverOptions: {},
          disableHierarchicalLookup: config.resolver.disableHierarchicalLookup,
          doesFileExist: filePath => lookup(filePath).type === 'f',
          extraNodeModules: config.resolver.extraNodeModules,
          fileSystemLookup: lookup,
          getPackage, getPackageForModule,
          mainFields: config.resolver.resolverMainFields,
          nodeModulesPaths: config.resolver.nodeModulesPaths,
          originModulePath,
          preferNativePlatform: true,
          resolveAsset: () => undefined,
          resolveHasteModule: () => undefined,
          resolveHastePackage: () => undefined,
          sourceExts: config.resolver.sourceExts,
          unstable_conditionNames: config.resolver.unstable_conditionNames,
          unstable_conditionsByPlatform: config.resolver.unstable_conditionsByPlatform,
          unstable_enablePackageExports: config.resolver.unstable_enablePackageExports,
          unstable_logWarning: message => { throw new Error(message); },
        }, { name: '', data: { isESMImport: true } });
        const resolve = (issuer, name, platform, useAppConfig) => {
          const input = context(issuer);
          if (useAppConfig) input.resolveRequest = config.resolver.resolveRequest;
          try {
            return Resolver.resolve(input, name, platform);
          } catch (error) {
            if (error instanceof Resolver.FailedToResolveNameError) {
              return { missing: true };
            }
            throw error;
          }
        };
        try {
          const external = path.join(issuerDir, 'workspace-source.ts');
          const app = path.join(root, 'src', 'App.tsx');
          const snapshot = {};
          for (const platform of ['ios', 'android']) {
            snapshot[platform] = Object.fromEntries(
              ${JSON.stringify(peerSpecifiers)}.map(name => [name, {
                plain: resolve(external, name, platform, false),
                app: resolve(app, name, platform, false),
                workspace: resolve(external, name, platform, true),
              }]),
            );
          }
          process.stdout.write('METRO_PEER_RESULT=' + JSON.stringify(snapshot) + '\\n');
        } finally {
          fs.rmdirSync(issuerDir);
        }
        `,
      ],
      {
        cwd: projectRoot,
        env: { ...process.env, WITH_ROZENITE: 'false' },
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      },
    );
    if (result.error || result.status !== 0) {
      throw new Error(result.error?.message || result.stderr || result.stdout);
    }
    const marker = 'METRO_PEER_RESULT=';
    const line = result.stdout
      .split('\n')
      .find(value => value.startsWith(marker));
    if (!line) {
      throw new Error(`Missing Metro resolution result: ${result.stdout}`);
    }
    snapshot = JSON.parse(line.slice(marker.length));
  }, 35000);

  describe.each(['ios', 'android'])('%s', platform => {
    it.each(peerSpecifiers)('keeps %s on the app instance', specifier => {
      const result = snapshot[platform][specifier];
      expect(result.plain).toEqual({ missing: true });
      expect(result.app.type).toBe('sourceFile');
      expect(result.workspace).toEqual(result.app);
      expect(result.workspace.filePath).toContain(
        path.join(projectRoot, 'node_modules'),
      );
    });

    it.each(['react-native-reanimated', 'react-native-gesture-handler'])(
      'preserves the react-native source entry for %s',
      specifier => {
        expect(snapshot[platform][specifier].workspace.filePath).toBe(
          path.join(projectRoot, 'node_modules', specifier, 'src', 'index.ts'),
        );
      },
    );

    it('preserves platform-specific child entry selection', () => {
      const specifier =
        'react-native-gesture-handler/src/components/GestureHandlerRootView';
      const suffix = platform === 'android' ? '.android.tsx' : '.tsx';
      expect(snapshot[platform][specifier].workspace.filePath).toBe(
        path.join(projectRoot, 'node_modules', specifier + suffix),
      );
    });
  });
});
