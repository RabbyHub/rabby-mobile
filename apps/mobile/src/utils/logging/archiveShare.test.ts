type MockFile = {
  name: string;
  path: string;
  mtime: Date | null;
  isFile: () => boolean;
};

function makeFile(name: string, modifiedAt: number): MockFile {
  return {
    name,
    path: `/documents/applogs/${name}`,
    mtime: new Date(modifiedAt),
    isFile: () => true,
  };
}

function loadArchiveShare({
  exportedSnapshotPath,
  files = [],
  logRootExists = true,
}: {
  exportedSnapshotPath: string | null;
  files?: MockFile[];
  logRootExists?: boolean;
}) {
  jest.resetModules();

  const rnfs = {
    TemporaryDirectoryPath: '/tmp',
    CachesDirectoryPath: '/cache',
    exists: jest.fn(async (path: string) =>
      path === '/documents/applogs' ? logRootExists : false,
    ),
    mkdir: jest.fn(async () => undefined),
    readDir: jest.fn(async () => files),
  };
  const logger = {
    flush: jest.fn(async () => undefined),
    exportArchiveSnapshot: jest.fn(async () => exportedSnapshotPath),
    getState: jest.fn(() => ({
      activeEntryPath: '/documents/applogs/current.log',
    })),
  };

  jest.doMock('@rabby-wallet/react-native-fs', () => ({
    __esModule: true,
    default: rnfs,
  }));
  jest.doMock('@/utils/logger', () => ({
    APP_LOG_ROOT_PATH: '/documents/applogs',
    logger,
  }));

  return {
    ...require('./archiveShare'),
    logger,
    rnfs,
  } as typeof import('./archiveShare') & {
    logger: typeof logger;
    rnfs: typeof rnfs;
  };
}

describe('prepareLatestAppLogArchiveForSharing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exports active logs as a temporary snapshot', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    const { prepareLatestAppLogArchiveForSharing, logger, rnfs } =
      loadArchiveShare({
        exportedSnapshotPath: '/tmp/rabby-log-share/current.zip',
      });

    await expect(prepareLatestAppLogArchiveForSharing()).resolves.toEqual({
      path: '/tmp/rabby-log-share/current.zip',
      name: 'current.zip',
      cleanupPaths: ['/tmp/rabby-log-share/current.zip'],
      preferredLatestLogEntryPath: '/documents/applogs/current.log',
    });
    expect(logger.flush).toHaveBeenCalledTimes(1);
    expect(logger.exportArchiveSnapshot).toHaveBeenCalledWith(
      '/tmp/rabby-log-share/rabby-mobile-logs-share-1234.zip',
    );
    expect(rnfs.readDir).not.toHaveBeenCalled();
  });

  it('falls back to the latest finalized zip', async () => {
    const { prepareLatestAppLogArchiveForSharing } = loadArchiveShare({
      exportedSnapshotPath: null,
      files: [
        makeFile('rabby-mobile-logs-older.zip', 1),
        makeFile('rabby-mobile-logs-current.log', 3),
        makeFile('rabby-mobile-logs-newer.zip', 2),
      ],
    });

    await expect(prepareLatestAppLogArchiveForSharing()).resolves.toEqual({
      path: '/documents/applogs/rabby-mobile-logs-newer.zip',
      name: 'rabby-mobile-logs-newer.zip',
      cleanupPaths: [],
      preferredLatestLogEntryPath: null,
    });
  });

  it('returns null when no app log archive is available', async () => {
    const { prepareLatestAppLogArchiveForSharing } = loadArchiveShare({
      exportedSnapshotPath: null,
      logRootExists: false,
    });

    await expect(prepareLatestAppLogArchiveForSharing()).resolves.toBeNull();
  });
});
