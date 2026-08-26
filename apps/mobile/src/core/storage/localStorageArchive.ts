import RNFS from '@rabby-wallet/react-native-fs';

import { IS_LOCAL_STORAGE_EXPORT_ENABLED } from '@/constant/env';
import { getRabbyAppDbName, getRabbyAppDbPath } from '@/databases/constant';
import { APP_DOCUMENT_LIKE_PATH, MMKV_ROOT_PATH } from '@/core/utils/appFS';
import { prepareLatestAppLogArchiveForSharing } from '@/utils/logging/archiveShare';
import { shareLocalFile } from '@/utils/shareLocalFile';
import { ALL_KNOWN_MMKV_INSTANCES, keyringMMKV } from './mmkvInstances';

const ARCHIVE_ROOT_DIR_NAME = 'rabby-local-storage-export';
const ARCHIVE_MIME_TYPE = 'application/zip';
const KEYRING_STARTUP_DIAGNOSTICS_PATH = `${APP_DOCUMENT_LIKE_PATH}/keyring-startup-diagnostics`;

type ArchiveEntry = {
  sourcePath: string;
  archivePath: string;
};

type RawMMKVDumpEntry =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'buffer'; value: number[] }
  | { type: 'unreadable'; errors: string[] };

type RawMMKVDump = {
  schemaVersion: 1;
  generatedAt: string;
  storageId: string;
  encoding: 'native-mmkv-raw-values';
  keyCount: number;
  entries: Record<string, RawMMKVDumpEntry>;
  error?: string;
};

function isSafeArchiveFileName(fileName: string) {
  return /^[a-zA-Z0-9._-]+$/.test(fileName);
}

function getArchiveTempDir() {
  return `${
    RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath
  }/${ARCHIVE_ROOT_DIR_NAME}`;
}

async function collectMMKVArchiveEntries(): Promise<ArchiveEntry[]> {
  if (!(await RNFS.exists(MMKV_ROOT_PATH))) {
    return [];
  }

  const files = await RNFS.readDir(MMKV_ROOT_PATH);

  return files.flatMap(file => {
    if (!file.isFile() || !isSafeArchiveFileName(file.name)) {
      return [];
    }

    return [
      {
        sourcePath: file.path,
        archivePath: `mmkv/${file.name}`,
      },
    ];
  });
}

async function collectSQLiteArchiveEntries(): Promise<ArchiveEntry[]> {
  const dbPath = getRabbyAppDbPath();
  const dbName = getRabbyAppDbName();
  const candidates = [
    { path: dbPath, archiveName: dbName },
    { path: `${dbPath}-shm`, archiveName: `${dbName}-shm` },
    { path: `${dbPath}-wal`, archiveName: `${dbName}-wal` },
  ];

  const existing = await Promise.all(
    candidates.map(async candidate => ({
      ...candidate,
      exists: await RNFS.exists(candidate.path),
    })),
  );

  return existing.flatMap(candidate =>
    candidate.exists
      ? [
          {
            sourcePath: candidate.path,
            archivePath: `sqlite/${candidate.archiveName}`,
          },
        ]
      : [],
  );
}

async function collectArchiveEntriesRecursively({
  sourceDir,
  archiveDir,
}: {
  sourceDir: string;
  archiveDir: string;
}): Promise<ArchiveEntry[]> {
  if (!(await RNFS.exists(sourceDir))) {
    return [];
  }

  const files = await RNFS.readDir(sourceDir);
  const entries: ArchiveEntry[] = [];

  for (const file of files) {
    if (!isSafeArchiveFileName(file.name)) {
      continue;
    }

    const archivePath = `${archiveDir}/${file.name}`;
    if (file.isFile()) {
      entries.push({ sourcePath: file.path, archivePath });
    } else if (file.isDirectory()) {
      entries.push(
        ...(await collectArchiveEntriesRecursively({
          sourceDir: file.path,
          archiveDir: archivePath,
        })),
      );
    }
  }

  return entries;
}

async function collectKeyringStartupDiagnosticArchiveEntries() {
  return collectArchiveEntriesRecursively({
    sourceDir: KEYRING_STARTUP_DIAGNOSTICS_PATH,
    archiveDir: 'keyring-startup-diagnostics',
  });
}

function isNativeZipArchiveAvailable() {
  try {
    return RNFS.isNativeZipArchiveAvailable();
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function readRawMMKVEntry(
  storage: typeof keyringMMKV,
  key: string,
): RawMMKVDumpEntry {
  const errors: string[] = [];

  try {
    const value = storage.getString(key);
    if (value !== undefined) {
      return { type: 'string', value };
    }
  } catch (error) {
    errors.push(`string: ${getErrorMessage(error)}`);
  }

  try {
    const value = storage.getNumber(key);
    if (value !== undefined) {
      return { type: 'number', value };
    }
  } catch (error) {
    errors.push(`number: ${getErrorMessage(error)}`);
  }

  try {
    const value = storage.getBoolean(key);
    if (value !== undefined) {
      return { type: 'boolean', value };
    }
  } catch (error) {
    errors.push(`boolean: ${getErrorMessage(error)}`);
  }

  try {
    const value = storage.getBuffer(key);
    if (value !== undefined) {
      return { type: 'buffer', value: Array.from(value) };
    }
  } catch (error) {
    errors.push(`buffer: ${getErrorMessage(error)}`);
  }

  return { type: 'unreadable', errors };
}

function createRawMMKVDump(
  storageId: string,
  storage: typeof keyringMMKV,
): RawMMKVDump {
  try {
    const keys = storage.getAllKeys().slice().sort();

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      storageId,
      encoding: 'native-mmkv-raw-values',
      keyCount: keys.length,
      entries: Object.fromEntries(
        keys.map(key => [key, readRawMMKVEntry(storage, key)]),
      ),
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      storageId,
      encoding: 'native-mmkv-raw-values',
      keyCount: 0,
      entries: {},
      error: getErrorMessage(error),
    };
  }
}

async function writeRawMMKVDumps({
  archiveDir,
  timestamp,
}: {
  archiveDir: string;
  timestamp: number;
}) {
  const entries: ArchiveEntry[] = [];
  const cleanupPaths: string[] = [];
  let totalKeyCount = 0;

  for (const [storageId, storage] of Object.entries(
    ALL_KNOWN_MMKV_INSTANCES,
  ).sort(([firstId], [secondId]) => firstId.localeCompare(secondId))) {
    const name = `rabby-mmkv-${storageId}-${timestamp}.json`;
    const path = `${archiveDir}/${name}`;
    const dump = createRawMMKVDump(storageId, storage);

    await RNFS.writeFile(path, JSON.stringify(dump, null, 2), 'utf8');

    entries.push({
      sourcePath: path,
      archivePath: `mmkv-json/${storageId}.json`,
    });
    cleanupPaths.push(path);
    totalKeyCount += dump.keyCount;
  }

  return {
    entries,
    cleanupPaths,
    storageCount: entries.length,
    totalKeyCount,
  };
}

export type LocalStorageArchiveShareResult = {
  dismissed: boolean;
  fileCount: number;
  mmkvDumpCount: number;
  mmkvDumpKeyCount: number;
  keyringStartupDiagnosticFileCount: number;
  appLogArchiveCount: number;
};

/**
 * Non-production, user-confirmed export of raw local storage and app logs.
 * The archive intentionally includes SQLite WAL companions, every current
 * MMKV-root file, and the same latest app-log ZIP used by the log share action.
 */
export async function shareCurrentLocalStorageArchive(): Promise<LocalStorageArchiveShareResult> {
  if (!IS_LOCAL_STORAGE_EXPORT_ENABLED) {
    throw new Error('Local storage export is unavailable in this build.');
  }

  if (!isNativeZipArchiveAvailable()) {
    throw new Error('Native ZIP export is unavailable in this build.');
  }

  const [
    mmkvEntries,
    sqliteEntries,
    keyringStartupDiagnosticEntries,
    latestAppLogArchive,
  ] = await Promise.all([
    collectMMKVArchiveEntries(),
    collectSQLiteArchiveEntries(),
    collectKeyringStartupDiagnosticArchiveEntries(),
    prepareLatestAppLogArchiveForSharing(),
  ]);
  const appLogEntries = latestAppLogArchive
    ? [
        {
          sourcePath: latestAppLogArchive.path,
          archivePath: `app-logs/${latestAppLogArchive.name}`,
        },
      ]
    : [];
  const entries = [
    ...mmkvEntries,
    ...sqliteEntries,
    ...keyringStartupDiagnosticEntries,
    ...appLogEntries,
  ];

  if (entries.length === 0) {
    throw new Error('No local MMKV or SQLite files are available to export.');
  }

  const archiveDir = getArchiveTempDir();
  const timestamp = Date.now();
  const fileName = `rabby-local-storage-${timestamp}.zip`;
  const archivePath = `${archiveDir}/${fileName}`;
  let rawMMKVDumpPaths: string[] = [];
  const appLogCleanupPaths = latestAppLogArchive?.cleanupPaths || [];

  await RNFS.mkdir(archiveDir, {
    NSURLIsExcludedFromBackupKey: true,
  });

  try {
    const rawMMKVDumps = await writeRawMMKVDumps({ archiveDir, timestamp });
    rawMMKVDumpPaths = rawMMKVDumps.cleanupPaths;
    const archiveEntries = [...entries, ...rawMMKVDumps.entries];
    await RNFS.createZipArchive(archivePath, archiveEntries);

    const archiveResult = await shareLocalFile({
      path: archivePath,
      name: fileName,
      mimeType: ARCHIVE_MIME_TYPE,
      title: 'Share local storage archive',
      subject: fileName,
      message: 'Rabby local storage and app log diagnostic archive',
      cleanupPaths: [archivePath, ...rawMMKVDumpPaths, ...appLogCleanupPaths],
    });

    return {
      ...archiveResult,
      fileCount: archiveEntries.length,
      mmkvDumpCount: rawMMKVDumps.storageCount,
      mmkvDumpKeyCount: rawMMKVDumps.totalKeyCount,
      keyringStartupDiagnosticFileCount: keyringStartupDiagnosticEntries.length,
      appLogArchiveCount: appLogEntries.length,
    };
  } catch (error) {
    await Promise.allSettled(
      [archivePath, ...rawMMKVDumpPaths, ...appLogCleanupPaths].map(
        async path => {
          if (await RNFS.exists(path)) {
            await RNFS.unlink(path);
          }
        },
      ),
    );

    throw error;
  }
}
