import RNFS from '@rabby-wallet/react-native-fs';
import { logger } from '@/utils/logger';
import { prepareLatestAppLogArchiveForSharing } from '../archiveShare';

jest.mock('@rabby-wallet/react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  mkdir: jest.fn(),
  exists: jest.fn(),
  unlink: jest.fn(),
  readDir: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({
  APP_LOG_ROOT_PATH: '/applogs',
  logger: {
    flush: jest.fn(),
    exportArchiveSnapshot: jest.fn(),
    getState: jest.fn(),
  },
}));

const fs = jest.mocked(RNFS);
const log = jest.mocked(logger);

function file(name: string, mtime: number, isFile = true) {
  return {
    name,
    path: `/applogs/${name}`,
    mtime: new Date(mtime),
    isFile: () => isFile,
  } as Awaited<ReturnType<typeof RNFS.readDir>>[number];
}

describe('latest app log archive preparation (native I/O mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.exists.mockResolvedValue(true);
    fs.mkdir.mockResolvedValue(undefined);
    fs.unlink.mockResolvedValue(undefined);
    fs.readDir.mockResolvedValue([]);
    log.flush.mockResolvedValue(undefined);
    log.exportArchiveSnapshot.mockResolvedValue(null);
    log.getState.mockReturnValue({
      activeEntryPath: '/applogs/current.log',
    } as ReturnType<typeof logger.getState>);
  });

  it('prefers a flushed live snapshot over historical archives without finalizing logs', async () => {
    log.exportArchiveSnapshot.mockImplementation(async path => path || null);
    const result = await prepareLatestAppLogArchiveForSharing();
    expect(log.flush).toHaveBeenCalledTimes(1);
    expect(log.flush.mock.invocationCallOrder[0]).toBeLessThan(
      log.exportArchiveSnapshot.mock.invocationCallOrder[0],
    );
    expect(result).toMatchObject({
      path: expect.stringMatching(/^\/tmp\/rabby-log-share\/.*\.zip$/),
      preferredLatestLogEntryPath: 'logs/current.log',
    });
    expect(result?.cleanupPaths).toEqual([result?.path]);
    expect(fs.readDir).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('selects only the newest finalized zip and never schedules retained logs for deletion', async () => {
    fs.readDir.mockResolvedValue([
      file('older.zip', 10),
      file('newer.zip', 20),
      file('partial.zip.partial', 100),
      file('current.log', 100),
      file('directory.zip', 100, false),
    ]);
    expect(await prepareLatestAppLogArchiveForSharing()).toEqual({
      path: '/applogs/newer.zip',
      name: 'newer.zip',
      cleanupPaths: [],
    });
  });

  it('returns null when neither current segments nor finalized archives exist', async () => {
    fs.exists.mockResolvedValue(false);
    await expect(prepareLatestAppLogArchiveForSharing()).resolves.toBeNull();
    expect(fs.readDir).not.toHaveBeenCalled();
  });

  it('returns null for an existing log directory with no finalized zip', async () => {
    fs.readDir.mockResolvedValue([file('partial.zip.partial', 100)]);
    await expect(prepareLatestAppLogArchiveForSharing()).resolves.toBeNull();
  });

  it('cleans a partial snapshot when native export fails and preserves the original failure', async () => {
    const failure = new Error('native zip failed');
    log.exportArchiveSnapshot.mockRejectedValueOnce(failure);
    fs.unlink.mockRejectedValueOnce(new Error('cleanup failed'));
    await expect(prepareLatestAppLogArchiveForSharing()).rejects.toBe(failure);
    expect(fs.unlink).toHaveBeenCalledWith(
      log.exportArchiveSnapshot.mock.calls[0][0],
    );
  });

  it('does not share a snapshot missing after native export', async () => {
    log.exportArchiveSnapshot.mockImplementation(async path => path || null);
    fs.exists.mockResolvedValue(false);
    await expect(prepareLatestAppLogArchiveForSharing()).rejects.toThrow(
      'The app log snapshot is unavailable.',
    );
  });
});
