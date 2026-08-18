import RNFS from '@rabby-wallet/react-native-fs';

import { isNonPublicProductionEnv } from '@/constant';
import { getRabbyAppDbName, getRabbyAppDbPath } from '@/databases/constant';
import { MMKV_ROOT_PATH } from '@/core/utils/appFS';
import { shareLocalFile } from '@/utils/shareLocalFile';
import { keyringMMKV } from './mmkvInstances';

const ARCHIVE_ROOT_DIR_NAME = 'rabby-local-storage-export';
const ARCHIVE_MIME_TYPE = 'application/zip';

type ArchiveEntry = {
  sourcePath: string;
  archivePath: string;
};

type KeyringDumpEntry =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'buffer'; value: number[] }
  | { type: 'unreadable'; errors: string[] };

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

function readRawKeyringEntry(key: string): KeyringDumpEntry {
  const errors: string[] = [];

  try {
    const value = keyringMMKV.getString(key);
    if (value !== undefined) {
      return { type: 'string', value };
    }
  } catch (error) {
    errors.push(`string: ${getErrorMessage(error)}`);
  }

  try {
    const value = keyringMMKV.getNumber(key);
    if (value !== undefined) {
      return { type: 'number', value };
    }
  } catch (error) {
    errors.push(`number: ${getErrorMessage(error)}`);
  }

  try {
    const value = keyringMMKV.getBoolean(key);
    if (value !== undefined) {
      return { type: 'boolean', value };
    }
  } catch (error) {
    errors.push(`boolean: ${getErrorMessage(error)}`);
  }

  try {
    const value = keyringMMKV.getBuffer(key);
    if (value !== undefined) {
      return { type: 'buffer', value: Array.from(value) };
    }
  } catch (error) {
    errors.push(`buffer: ${getErrorMessage(error)}`);
  }

  return { type: 'unreadable', errors };
}

function createRawKeyringDump() {
  try {
    const keys = keyringMMKV.getAllKeys().slice().sort();

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      encoding: 'native-mmkv-raw-values',
      keyCount: keys.length,
      entries: Object.fromEntries(
        keys.map(key => [key, readRawKeyringEntry(key)]),
      ),
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      encoding: 'native-mmkv-raw-values',
      keyCount: 0,
      entries: {},
      error: getErrorMessage(error),
    };
  }
}

async function writeRawKeyringDump({
  archiveDir,
  timestamp,
}: {
  archiveDir: string;
  timestamp: number;
}) {
  const name = `rabby-keyring-mmkv-${timestamp}.json`;
  const path = `${archiveDir}/${name}`;
  const dump = createRawKeyringDump();

  await RNFS.writeFile(path, JSON.stringify(dump, null, 2), 'utf8');

  return {
    path,
    name,
    keyCount: dump.keyCount,
  };
}

export type LocalStorageArchiveShareResult = {
  archive: {
    dismissed: boolean;
    fileCount: number;
  };
  keyringDump: {
    dismissed: boolean;
    keyCount: number;
  };
};

/**
 * Non-production, user-confirmed export of the raw MMKV and SQLite files.
 * The archive intentionally includes SQLite WAL companions and every current
 * MMKV-root file so native storage type corruption can be inspected offline.
 */
export async function shareCurrentLocalStorageArchive(): Promise<LocalStorageArchiveShareResult> {
  if (!isNonPublicProductionEnv) {
    throw new Error(
      'Local storage export is unavailable in production builds.',
    );
  }

  if (!isNativeZipArchiveAvailable()) {
    throw new Error('Native ZIP export is unavailable in this build.');
  }

  const [mmkvEntries, sqliteEntries] = await Promise.all([
    collectMMKVArchiveEntries(),
    collectSQLiteArchiveEntries(),
  ]);
  const entries = [...mmkvEntries, ...sqliteEntries];

  if (entries.length === 0) {
    throw new Error('No local MMKV or SQLite files are available to export.');
  }

  const archiveDir = getArchiveTempDir();
  const timestamp = Date.now();
  const fileName = `rabby-local-storage-${timestamp}.zip`;
  const archivePath = `${archiveDir}/${fileName}`;

  await RNFS.mkdir(archiveDir, {
    NSURLIsExcludedFromBackupKey: true,
  });

  try {
    await RNFS.createZipArchive(archivePath, entries);
    const keyringDump = await writeRawKeyringDump({ archiveDir, timestamp });

    const archiveResult = await shareLocalFile({
      path: archivePath,
      name: fileName,
      mimeType: ARCHIVE_MIME_TYPE,
      title: 'Share local storage archive',
      subject: fileName,
      message: 'Rabby local MMKV and SQLite diagnostic archive',
      cleanupPaths: [archivePath],
    });
    const keyringDumpResult = await shareLocalFile({
      path: keyringDump.path,
      name: keyringDump.name,
      mimeType: 'application/json',
      title: 'Share raw keyring MMKV dump',
      subject: keyringDump.name,
      message: 'Rabby raw keyring MMKV diagnostic dump',
      cleanupPaths: [keyringDump.path],
    });

    return {
      archive: {
        ...archiveResult,
        fileCount: entries.length,
      },
      keyringDump: {
        ...keyringDumpResult,
        keyCount: keyringDump.keyCount,
      },
    };
  } catch (error) {
    await Promise.allSettled(
      [archivePath, `${archiveDir}/rabby-keyring-mmkv-${timestamp}.json`].map(
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
