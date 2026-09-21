import 'isomorphic-fetch';

jest.mock(
  'react-native-fs',
  () => ({
    DocumentDirectoryPath: '/mock/documents',
    TemporaryDirectoryPath: '/mock/tmp',
    CachesDirectoryPath: '/mock/caches',
    MainBundlePath: '/mock/bundle',
    LibraryDirectoryPath: '/mock/library',
    ExternalStorageDirectoryPath: '/mock/external',
    exists: jest.fn(async () => false),
    readDir: jest.fn(async () => []),
    readFile: jest.fn(async () => ''),
    readFileAssets: jest.fn(async () => ''),
    writeFile: jest.fn(async () => undefined),
    appendFile: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
    moveFile: jest.fn(async () => undefined),
    copyFile: jest.fn(async () => undefined),
    stat: jest.fn(async (path: string) => ({
      path,
      size: 0,
      mtime: new Date(0),
      ctime: new Date(0),
      isDirectory: () => false,
      isFile: () => true,
    })),
    getFSInfo: jest.fn(async () => ({
      freeSpace: 0,
      totalSpace: 0,
    })),
    downloadFile: jest.fn(() => ({
      jobId: 1,
      promise: Promise.resolve({
        statusCode: 200,
        bytesWritten: 0,
      }),
    })),
  }),
  { virtual: true },
);

jest.mock(
  '@rabby-wallet/react-native-fs',
  () => jest.requireMock('react-native-fs'),
  {
    virtual: true,
  },
);

jest.mock(
  'react-native-device-info',
  () => ({
    __esModule: true,
    default: {
      getApiLevel: jest.fn(async () => 35),
      getApplicationName: jest.fn(() => 'Rabby Mobile'),
      getBrand: jest.fn(() => 'test'),
      getBuildNumber: jest.fn(() => '1'),
      getBundleId: jest.fn(() => 'com.debank.rabbymobile.test'),
      getDeviceId: jest.fn(() => 'test-device'),
      getModel: jest.fn(() => 'test-model'),
      getSystemName: jest.fn(() => 'test-os'),
      getSystemVersion: jest.fn(() => '1.0'),
      getVersion: jest.fn(() => '0.0.0-test'),
      hasNotch: jest.fn(() => false),
      isEmulator: jest.fn(async () => false),
    },
    getApiLevel: jest.fn(async () => 35),
    getApplicationName: jest.fn(() => 'Rabby Mobile'),
    getBrand: jest.fn(() => 'test'),
    getBuildNumber: jest.fn(() => '1'),
    getBundleId: jest.fn(() => 'com.debank.rabbymobile.test'),
    getDeviceId: jest.fn(() => 'test-device'),
    getModel: jest.fn(() => 'test-model'),
    getSystemName: jest.fn(() => 'test-os'),
    getSystemVersion: jest.fn(() => '1.0'),
    getVersion: jest.fn(() => '0.0.0-test'),
    hasNotch: jest.fn(() => false),
    isEmulator: jest.fn(async () => false),
  }),
  { virtual: true },
);
