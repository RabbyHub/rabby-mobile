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
  exportEnabled,
  writeFile = jest.fn(async () => undefined),
  latestLogArchive = null,
}: {
  exportEnabled: boolean;
  writeFile?: jest.Mock;
  latestLogArchive?: {
    name: string;
    path: string;
    cleanupPaths: string[];
  } | null;
}) {
  jest.resetModules();

  const exists = jest.fn(
    async (path: string) => path !== '/documents/rabby.db',
  );
  const unlink = jest.fn(async () => undefined);
  const createZipArchive = jest.fn(async () => undefined);
  const shareLocalFile = jest.fn(async () => ({ dismissed: false }));
  const mkdir = jest.fn(async () => undefined);
  const prepareLatestAppLogArchiveForSharing = jest.fn(
    async () => latestLogArchive,
  );

  jest.doMock('@/constant/env', () => ({
    IS_LOCAL_STORAGE_EXPORT_ENABLED: exportEnabled,
  }));
  jest.doMock('@/utils/logging/archiveShare', () => ({
    prepareLatestAppLogArchiveForSharing,
  }));
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
    mkdir,
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
    mocks: {
      createZipArchive,
      exists,
      mkdir,
      prepareLatestAppLogArchiveForSharing,
      shareLocalFile,
      unlink,
      writeFile,
    },
  };
}

describe('local storage archive', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('rejects disabled exports before touching local storage or app logs', async () => {
    const { module, mocks } = loadLocalStorageArchive({
      exportEnabled: false,
    });

    await expect(module.shareCurrentLocalStorageArchive()).rejects.toThrow(
      'Local storage export is unavailable in this build.',
    );
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.shareLocalFile).not.toHaveBeenCalled();
    expect(mocks.prepareLatestAppLogArchiveForSharing).not.toHaveBeenCalled();
  });

  it('removes every attempted raw MMKV dump when a write fails', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(123);
    const writeFailure = new Error('disk write failed');
    const writeFile = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(writeFailure);
    const { module, mocks } = loadLocalStorageArchive({
      exportEnabled: true,
      writeFile,
      latestLogArchive: {
        name: 'snapshot.zip',
        path: '/tmp/snapshot.zip',
        cleanupPaths: ['/tmp/snapshot.zip'],
      },
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
    expect(mocks.unlink).toHaveBeenCalledWith('/tmp/snapshot.zip');
  });

  it('includes the latest log zip and cleans generated files after sharing', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(123);
    const { module, mocks } = loadLocalStorageArchive({
      exportEnabled: true,
      latestLogArchive: {
        name: 'snapshot.zip',
        path: '/tmp/snapshot.zip',
        cleanupPaths: ['/tmp/snapshot.zip'],
      },
    });
    const result = await module.shareCurrentLocalStorageArchive();
    expect(result).toMatchObject({ appLogArchiveCount: 1, mmkvDumpCount: 2 });
    expect(mocks.createZipArchive).toHaveBeenCalledWith(
      '/tmp/rabby-local-storage-export/rabby-local-storage-123.zip',
      expect.arrayContaining([
        {
          sourcePath: '/tmp/snapshot.zip',
          archivePath: 'app-logs/snapshot.zip',
        },
      ]),
    );
    expect(mocks.unlink).toHaveBeenCalledWith('/tmp/snapshot.zip');
    expect(mocks.unlink).toHaveBeenCalledWith(
      '/tmp/rabby-local-storage-export/rabby-local-storage-123.zip',
    );
  });

  it('can export storage when no app logs exist', async () => {
    const { module, mocks } = loadLocalStorageArchive({ exportEnabled: true });
    await expect(
      module.shareCurrentLocalStorageArchive(),
    ).resolves.toMatchObject({ appLogArchiveCount: 0 });
    expect(mocks.shareLocalFile).toHaveBeenCalledTimes(1);
  });

  it.each(['mkdir', 'createZipArchive', 'shareLocalFile'] as const)(
    'cleans the temporary log snapshot when %s fails',
    async operation => {
      const { module, mocks } = loadLocalStorageArchive({
        exportEnabled: true,
        latestLogArchive: {
          name: 'snapshot.zip',
          path: '/tmp/snapshot.zip',
          cleanupPaths: ['/tmp/snapshot.zip'],
        },
      });
      const error = new Error('export failed');
      mocks[operation].mockRejectedValueOnce(error);
      await expect(module.shareCurrentLocalStorageArchive()).rejects.toBe(
        error,
      );
      expect(mocks.unlink).toHaveBeenCalledWith('/tmp/snapshot.zip');
    },
  );

  it('does not remove a retained log archive after sharing is dismissed', async () => {
    const { module, mocks } = loadLocalStorageArchive({
      exportEnabled: true,
      latestLogArchive: {
        name: 'retained.zip',
        path: '/applogs/retained.zip',
        cleanupPaths: [],
      },
    });
    mocks.shareLocalFile.mockResolvedValueOnce({ dismissed: true });
    await expect(
      module.shareCurrentLocalStorageArchive(),
    ).resolves.toMatchObject({ dismissed: true });
    expect(mocks.unlink).not.toHaveBeenCalledWith('/applogs/retained.zip');
  });
});
