import RNFS from '@rabby-wallet/react-native-fs';

import { APP_LOG_ROOT_PATH, logger } from '@/utils/logger';

const LOG_SHARE_TEMP_DIR_NAME = 'rabby-log-share';

export type PreparedLatestAppLogArchive = {
  path: string;
  name: string;
  cleanupPaths: string[];
  preferredLatestLogEntryPath: string | null;
};

function getFileBaseName(filePath: string) {
  return filePath.split('/').pop() || filePath;
}

function getLogShareTempDir() {
  return `${
    RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || APP_LOG_ROOT_PATH
  }/${LOG_SHARE_TEMP_DIR_NAME}`;
}

async function findLatestFinalizedLogArchive() {
  if (!(await RNFS.exists(APP_LOG_ROOT_PATH))) {
    return null;
  }

  const files = await RNFS.readDir(APP_LOG_ROOT_PATH);
  const latestArchive = files
    .filter(file => file.isFile() && file.name.endsWith('.zip'))
    .sort((left, right) => {
      const modifiedAtDiff =
        (right.mtime?.getTime() || 0) - (left.mtime?.getTime() || 0);

      return modifiedAtDiff || right.name.localeCompare(left.name);
    })[0];

  if (!latestArchive) {
    return null;
  }

  return {
    path: latestArchive.path,
    name: latestArchive.name,
    cleanupPaths: [],
    preferredLatestLogEntryPath: null,
  } satisfies PreparedLatestAppLogArchive;
}

/**
 * Prepares the same latest app-log ZIP used by the debug log share action.
 * Active text/partial logs are exported as a temporary snapshot; if there is
 * no active log, the latest finalized archive is returned without modifying it.
 */
export async function prepareLatestAppLogArchiveForSharing(): Promise<PreparedLatestAppLogArchive | null> {
  await logger.flush();

  const preferredLatestLogEntryPath = logger.getState().activeEntryPath || null;
  const shareTempDir = getLogShareTempDir();
  const snapshotPath = `${shareTempDir}/rabby-mobile-logs-share-${Date.now()}.zip`;

  await RNFS.mkdir(shareTempDir, {
    NSURLIsExcludedFromBackupKey: true,
  });

  const exportedSnapshotPath = await logger.exportArchiveSnapshot(snapshotPath);

  if (exportedSnapshotPath) {
    return {
      path: exportedSnapshotPath,
      name: getFileBaseName(exportedSnapshotPath),
      cleanupPaths: [exportedSnapshotPath],
      preferredLatestLogEntryPath,
    } satisfies PreparedLatestAppLogArchive;
  }

  return findLatestFinalizedLogArchive();
}
