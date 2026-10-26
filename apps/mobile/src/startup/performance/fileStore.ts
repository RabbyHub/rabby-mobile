import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import RNFS from '@rabby-wallet/react-native-fs';

import { APP_VERSIONS } from '@/constant';
import { APP_RUNTIME_ENV, BUILD_CHANNEL } from '@/constant/env';
import { APP_DOCUMENT_LIKE_PATH } from '@/core/utils/appFS';
import type { StartupPerformanceEventBatch } from './recorder';

export const STARTUP_PERFORMANCE_LOG_ROOT_PATH = `${APP_DOCUMENT_LIKE_PATH}/performance-logs`;

const FILE_PREFIX = 'rabby-startup-performance';
const FILE_SUFFIX = '.ndjson';
const PARTIAL_SUFFIX = `${FILE_SUFFIX}.partial`;
const WRITE_BUFFER_SIZE = 64 * 1024;
const WRITE_BUFFER_COUNT = 2;
const MAX_RETAINED_FILES = 20;
const MAX_RETAINED_BYTES = 8 * 1024 * 1024;
const MAX_RETAINED_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type PerformanceLogFile = Awaited<ReturnType<typeof RNFS.readDir>>[number];

export type StartupPerformanceShareArtifact = {
  path: string;
  name: string;
  mimeType: string;
  cleanupPaths: string[];
  fileCount: number;
};

export type StartupPerformanceLogSummary = {
  rootExists: boolean;
  fileCount: number;
  totalBytes: number;
  latestFileName: string | null;
  latestFileSize: number;
  latestFileModifiedAt: string | null;
  nativeAsyncFileIOAvailable: boolean;
  nativeZipArchiveAvailable: boolean;
};

function getFileTimestamp(file: PerformanceLogFile) {
  const date = file.mtime || file.ctime;
  if (date instanceof Date) {
    return date.getTime();
  }

  if (date) {
    const timestamp = new Date(date).getTime();
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

function isFinalPerformanceLogFile(file: PerformanceLogFile) {
  return (
    file.isFile() &&
    file.name.startsWith(`${FILE_PREFIX}-`) &&
    file.name.endsWith(FILE_SUFFIX)
  );
}

function isPartialPerformanceLogFile(file: PerformanceLogFile) {
  return (
    file.isFile() &&
    file.name.startsWith(`${FILE_PREFIX}-`) &&
    file.name.endsWith(PARTIAL_SUFFIX)
  );
}

function makeBatchFileBaseName(batch: StartupPerformanceEventBatch) {
  return `${FILE_PREFIX}-${batch.sessionStartedAt}-${batch.sessionId}-${String(
    batch.chunkSequence,
  ).padStart(3, '0')}`;
}

function serializeJsonLine(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      schemaVersion: 1,
      type: 'serialization_error',
    });
  }
}

function buildBatchContents(
  batch: StartupPerformanceEventBatch,
  reason: string,
) {
  const lines = [
    serializeJsonLine({
      schemaVersion: batch.schemaVersion,
      type: 'session_chunk',
      sessionId: batch.sessionId,
      sessionStartedAt: batch.sessionStartedAt,
      chunkSequence: batch.chunkSequence,
      flushReason: reason,
      appVersion: APP_VERSIONS.fromNative,
      appBuildNumber: APP_VERSIONS.buildNumber,
      runtimeEnv: APP_RUNTIME_ENV,
      buildChannel: BUILD_CHANNEL,
      platform: Platform.OS,
      eventCount: batch.events.length,
      droppedEventCount: batch.droppedEventCount,
    }),
    ...batch.events.map(event => serializeJsonLine(event)),
  ];

  return `${lines.join('\n')}\n`;
}

function isNativeAsyncStreamAvailable() {
  try {
    return RNFS.isJSIAvailable() && RNFS.isNativeAsyncFileIOAvailable();
  } catch {
    return false;
  }
}

function isNativeZipArchiveAvailable() {
  try {
    return RNFS.isNativeZipArchiveAvailable();
  } catch {
    return false;
  }
}

async function writeContentsWithNativeStream(path: string, contents: string) {
  const contentsBytes = Buffer.from(contents, 'utf8');
  const writer = RNFS.createAsyncWriteStream(path, {
    bufferSize: WRITE_BUFFER_SIZE,
    bufferCount: WRITE_BUFFER_COUNT,
  });

  try {
    let offset = 0;
    while (offset < contentsBytes.byteLength) {
      const buffers: Uint8Array[] = [];
      const byteLengths: number[] = [];

      while (
        buffers.length < WRITE_BUFFER_COUNT &&
        offset < contentsBytes.byteLength
      ) {
        const buffer = writer.acquireBuffer();
        const byteLength = Math.min(
          buffer.byteLength,
          contentsBytes.byteLength - offset,
        );
        buffer.set(contentsBytes.subarray(offset, offset + byteLength));
        buffers.push(buffer);
        byteLengths.push(byteLength);
        offset += byteLength;
      }

      await writer.commitBatch(buffers, byteLengths);
    }
  } finally {
    await writer.close();
  }
}

async function writeContents(path: string, contents: string) {
  if (isNativeAsyncStreamAvailable()) {
    await writeContentsWithNativeStream(path, contents);
    return;
  }

  await RNFS.writeFile(path, contents, 'utf8');
}

async function listPerformanceLogFiles() {
  if (!(await RNFS.exists(STARTUP_PERFORMANCE_LOG_ROOT_PATH))) {
    return [] as PerformanceLogFile[];
  }

  return (await RNFS.readDir(STARTUP_PERFORMANCE_LOG_ROOT_PATH))
    .filter(isFinalPerformanceLogFile)
    .sort((left, right) => getFileTimestamp(right) - getFileTimestamp(left));
}

export async function getStartupPerformanceLogSummary(): Promise<StartupPerformanceLogSummary> {
  const rootExists = await RNFS.exists(STARTUP_PERFORMANCE_LOG_ROOT_PATH);
  const files = rootExists ? await listPerformanceLogFiles() : [];
  const latestFile = files[0] || null;

  return {
    rootExists,
    fileCount: files.length,
    totalBytes: files.reduce(
      (total, file) => total + (Number(file.size) || 0),
      0,
    ),
    latestFileName: latestFile?.name || null,
    latestFileSize: Number(latestFile?.size) || 0,
    latestFileModifiedAt: latestFile
      ? new Date(getFileTimestamp(latestFile)).toISOString()
      : null,
    nativeAsyncFileIOAvailable: isNativeAsyncStreamAvailable(),
    nativeZipArchiveAvailable: isNativeZipArchiveAvailable(),
  };
}

async function enforceRetention() {
  if (!(await RNFS.exists(STARTUP_PERFORMANCE_LOG_ROOT_PATH))) {
    return;
  }

  const now = Date.now();
  const entries = await RNFS.readDir(STARTUP_PERFORMANCE_LOG_ROOT_PATH);
  const partialFiles = entries.filter(isPartialPerformanceLogFile);
  const finalFiles = entries
    .filter(isFinalPerformanceLogFile)
    .sort((left, right) => getFileTimestamp(right) - getFileTimestamp(left));

  const filesToDelete = partialFiles.filter(
    file => now - getFileTimestamp(file) > MAX_RETAINED_AGE_MS,
  );
  let retainedBytes = 0;

  finalFiles.forEach((file, index) => {
    const fileSize = Number(file.size) || 0;
    const expired = now - getFileTimestamp(file) > MAX_RETAINED_AGE_MS;
    const exceedsCount = index >= MAX_RETAINED_FILES;
    const exceedsBytes =
      index > 0 && retainedBytes + fileSize > MAX_RETAINED_BYTES;

    if (expired || exceedsCount || exceedsBytes) {
      filesToDelete.push(file);
      return;
    }

    retainedBytes += fileSize;
  });

  await Promise.allSettled(filesToDelete.map(file => RNFS.unlink(file.path)));
}

export async function writeStartupPerformanceEventBatch(
  batch: StartupPerformanceEventBatch,
  reason: string,
) {
  await RNFS.mkdir(STARTUP_PERFORMANCE_LOG_ROOT_PATH, {
    NSURLIsExcludedFromBackupKey: true,
  });

  const baseName = makeBatchFileBaseName(batch);
  const partialPath = `${STARTUP_PERFORMANCE_LOG_ROOT_PATH}/${baseName}${PARTIAL_SUFFIX}`;
  const finalPath = `${STARTUP_PERFORMANCE_LOG_ROOT_PATH}/${baseName}${FILE_SUFFIX}`;
  const contents = buildBatchContents(batch, reason);

  try {
    await writeContents(partialPath, contents);
    await RNFS.moveFile(partialPath, finalPath);
    await enforceRetention();
    return finalPath;
  } catch (error) {
    if (await RNFS.exists(partialPath)) {
      await RNFS.unlink(partialPath).catch(() => undefined);
    }
    throw error;
  }
}

function getShareTempDir() {
  return `${
    RNFS.TemporaryDirectoryPath ||
    RNFS.CachesDirectoryPath ||
    STARTUP_PERFORMANCE_LOG_ROOT_PATH
  }/rabby-performance-log-share`;
}

export async function prepareStartupPerformanceLogShare(): Promise<StartupPerformanceShareArtifact | null> {
  const files = await listPerformanceLogFiles();
  if (files.length === 0) {
    return null;
  }

  const shareTempDir = getShareTempDir();
  await RNFS.mkdir(shareTempDir, {
    NSURLIsExcludedFromBackupKey: true,
  });

  const timestamp = Date.now();
  if (isNativeZipArchiveAvailable()) {
    const name = `rabby-mobile-startup-performance-${timestamp}.zip`;
    const path = `${shareTempDir}/${name}`;
    await RNFS.createZipArchive(
      path,
      [...files].reverse().map(file => ({
        sourcePath: file.path,
        archivePath: `performance-logs/${file.name}`,
        size: Number(file.size) || undefined,
        mtimeMs: getFileTimestamp(file) || undefined,
      })),
    );

    return {
      path,
      name,
      mimeType: 'application/zip',
      cleanupPaths: [path],
      fileCount: files.length,
    };
  }

  const latestFile = files[0];
  const name = `rabby-mobile-startup-performance-${timestamp}${FILE_SUFFIX}`;
  const path = `${shareTempDir}/${name}`;
  await RNFS.copyFile(latestFile.path, path);

  return {
    path,
    name,
    mimeType: 'application/x-ndjson',
    cleanupPaths: [path],
    fileCount: 1,
  };
}
