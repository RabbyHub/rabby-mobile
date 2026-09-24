import RNFS from '@rabby-wallet/react-native-fs';
import { APP_LOG_ROOT_PATH, logger } from '@/utils/logger';

export type PreparedAppLogArchive = {
  path: string;
  name: string;
  cleanupPaths: string[];
  preferredLatestLogEntryPath?: string | null;
};

let snapshotSequence = 0;

async function removeSnapshot(path: string) {
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

/** Flush and snapshot current text segments without finalizing the live writer. */
export async function prepareLatestAppLogArchiveForSharing(): Promise<PreparedAppLogArchive | null> {
  await logger.flush();

  const shareDir = `${
    RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || APP_LOG_ROOT_PATH
  }/rabby-log-share`;
  const snapshotName = `rabby-mobile-logs-share-${Date.now()}-${++snapshotSequence}.zip`;
  const snapshotPath = `${shareDir}/${snapshotName}`;

  try {
    await RNFS.mkdir(shareDir, { NSURLIsExcludedFromBackupKey: true });
    const exportedPath = await logger.exportArchiveSnapshot(snapshotPath);
    if (exportedPath) {
      if (!(await RNFS.exists(exportedPath))) {
        throw new Error('The app log snapshot is unavailable.');
      }
      const entryPath = logger.getState().activeEntryPath;
      return {
        path: exportedPath,
        name: exportedPath.split('/').pop() || snapshotName,
        cleanupPaths: [exportedPath],
        preferredLatestLogEntryPath: entryPath?.endsWith('.log')
          ? `logs/${entryPath.split('/').pop()}`
          : entryPath,
      };
    }
    await removeSnapshot(snapshotPath);
  } catch (error) {
    // Native writes can leave an incomplete output even when the promise rejects.
    await Promise.allSettled([removeSnapshot(snapshotPath)]);
    throw error;
  }

  if (!(await RNFS.exists(APP_LOG_ROOT_PATH))) {
    return null;
  }
  const files = await RNFS.readDir(APP_LOG_ROOT_PATH);
  const latestArchive = files
    .filter(file => file.isFile() && file.name.endsWith('.zip'))
    .sort(
      (left, right) =>
        (right.mtime?.getTime() || 0) - (left.mtime?.getTime() || 0) ||
        right.name.localeCompare(left.name),
    )[0];

  // Retained log archives belong to the logger, never to this export's cleanup.
  return latestArchive
    ? { path: latestArchive.path, name: latestArchive.name, cleanupPaths: [] }
    : null;
}
