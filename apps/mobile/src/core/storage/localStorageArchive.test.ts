type LocalStorageArchiveModule = typeof import('./localStorageArchive');

function createStorage() {
  return {
    getAllKeys: jest.fn(() => []),
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    getBuffer: jest.fn(),
  };
}

function loadLocalStorageArchive({
  isNonPublicProductionEnv,
  writeFile = jest.fn(async () => undefined),
}: {
  isNonPublicProductionEnv: boolean;
  writeFile?: jest.Mock;
}) {
  jest.resetModules();

  const exists = jest.fn(
    async (path: string) => path !== '/documents/rabby.db',
  );
  const unlink = jest.fn(async () => undefined);
  const createZipArchive = jest.fn(async () => undefined);
  const shareLocalFile = jest.fn(async () => ({ dismissed: false }));

  jest.doMock('@/constant', () => ({ isNonPublicProductionEnv }));
  jest.doMock('@/databases/constant', () => ({
    getRabbyAppDbName: () => 'rabby.db',
    getRabbyAppDbPath: () => '/documents/rabby.db',
  }));
  jest.doMock('@/core/utils/appFS', () => ({
    APP_DOCUMENT_LIKE_PATH: '/documents',
    MMKV_ROOT_PATH: '/mmkv',
  }));
  jest.doMock('@/utils/shareLocalFile', () => ({ shareLocalFile }));
  jest.doMock('./mmkvInstances', () => ({
    keyringMMKV: createStorage(),
    ALL_KNOWN_MMKV_INSTANCES: {
      first: createStorage(),
      second: createStorage(),
    },
  }));
  jest.doMock('@rabby-wallet/react-native-fs', () => ({
    TemporaryDirectoryPath: '/tmp',
    CachesDirectoryPath: '/cache',
    exists,
    readDir: jest.fn(async (path: string) =>
      path === '/mmkv'
        ? [
            {
              name: 'first.mmkv',
              path: '/mmkv/first.mmkv',
              isFile: () => true,
              isDirectory: () => false,
            },
          ]
        : [],
    ),
    isNativeZipArchiveAvailable: jest.fn(() => true),
    mkdir: jest.fn(async () => undefined),
    writeFile,
    createZipArchive,
    unlink,
  }));

  let module: LocalStorageArchiveModule | undefined;
  jest.isolateModules(() => {
    module = require('./localStorageArchive') as LocalStorageArchiveModule;
  });

  return {
    module: module as LocalStorageArchiveModule,
    mocks: { createZipArchive, exists, shareLocalFile, unlink, writeFile },
  };
}

describe('local storage archive', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('rejects production exports before touching local storage', async () => {
    const { module, mocks } = loadLocalStorageArchive({
      isNonPublicProductionEnv: false,
    });

    await expect(module.shareCurrentLocalStorageArchive()).rejects.toThrow(
      'Local storage export is unavailable in production builds.',
    );
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.shareLocalFile).not.toHaveBeenCalled();
  });

  it('removes every attempted raw MMKV dump when a write fails', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(123);
    const writeFailure = new Error('disk write failed');
    const writeFile = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(writeFailure);
    const { module, mocks } = loadLocalStorageArchive({
      isNonPublicProductionEnv: true,
      writeFile,
    });

    await expect(module.shareCurrentLocalStorageArchive()).rejects.toBe(
      writeFailure,
    );

    const archiveDir = '/tmp/rabby-local-storage-export';
    expect(mocks.unlink).toHaveBeenCalledWith(
      `${archiveDir}/rabby-mmkv-first-123.json`,
    );
    expect(mocks.unlink).toHaveBeenCalledWith(
      `${archiveDir}/rabby-mmkv-second-123.json`,
    );
    expect(mocks.createZipArchive).not.toHaveBeenCalled();
    expect(mocks.shareLocalFile).not.toHaveBeenCalled();
  });
});
