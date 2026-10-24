import { mkdtempSync, rmdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ModuleMap } from 'jest-haste-map';
import Resolver from 'jest-resolve';

const mobileRoot = resolve(__dirname, '../../..');
const appRequire = createRequire(join(mobileRoot, 'package.json'));
const peerSpecifiers = [
  'react',
  'react-native',
  'react-native-reanimated',
  'react-native-reanimated/mock',
  'react-native-gesture-handler',
  'react-native-gesture-handler/jestSetup',
];

type Mapper = Record<string, string | string[]>;

const createResolver = (moduleNameMapper: Mapper = {}) =>
  new Resolver(ModuleMap.create(mobileRoot), {
    rootDir: mobileRoot,
    extensions: ['.js', '.json', '.node', '.ts', '.tsx'],
    hasCoreModules: true,
    moduleDirectories: ['node_modules'],
    moduleNameMapper: Object.entries(moduleNameMapper).map(
      ([pattern, target]) => ({
        regex: new RegExp(pattern),
        moduleName: Array.isArray(target)
          ? target.map(path => path.replace('<rootDir>', mobileRoot))
          : target.replace('<rootDir>', mobileRoot),
      }),
    ),
  });

describe('app-owned native peers in Jest', () => {
  let issuerDirectory: string;
  let issuer: string;

  beforeAll(() => {
    // An external source issuer cannot accidentally use an ignored workspace
    // node_modules link or a hoisted second copy of a native peer.
    issuerDirectory = mkdtempSync(join(tmpdir(), 'rabby-jest-native-peers-'));
    issuer = join(issuerDirectory, 'external-workspace-source.ts');
  });

  afterAll(() => {
    rmdirSync(issuerDirectory);
  });

  it.each(peerSpecifiers)(
    'cannot resolve %s without the app ownership mapping',
    specifier => {
      expect(() => createResolver().resolveModule(issuer, specifier)).toThrow(
        /Cannot find module/,
      );
    },
  );

  describe.each(['jest.config.js', 'jest.integration.config.js'])(
    '%s',
    configName => {
      it.each(peerSpecifiers)('resolves %s to the app peer', specifier => {
        // Read the real configuration and run the real Jest resolver. Only
        // resolution is exercised; native packages are not executed in Node.
        const config = appRequire(join(mobileRoot, configName)) as {
          moduleNameMapper?: Mapper;
        };
        const resolver = createResolver(config.moduleNameMapper);

        expect(resolver.resolveModule(issuer, specifier)).toBe(
          appRequire.resolve(specifier),
        );
      });
    },
  );
});
