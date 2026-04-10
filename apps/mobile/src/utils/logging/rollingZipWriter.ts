import { strToU8, unzipSync, Zip, ZipDeflate } from 'fflate';
import { formatDateFolder, formatFileTimestamp } from './format';

export type LoggingFileSystemEntry = {
  name: string;
  path: string;
  size: number;
  mtimeMs?: number;
};

export interface LoggingFileSystemAdapter {
  mkdir(path: string): Promise<void>;
  readFile(path: string, encoding: 'base64'): Promise<string>;
  writeFile(path: string, contents: string, encoding: 'base64'): Promise<void>;
  appendFile(path: string, contents: string, encoding: 'base64'): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  listFiles(path: string): Promise<LoggingFileSystemEntry[]>;
  unlink(path: string): Promise<void>;
}

export type RollingZipWriterState = {
  rootDir: string;
  activeArchiveTempPath: string | null;
  activeArchivePath: string | null;
  activeEntryPath: string | null;
  activeEntryBytes: number;
};

type RollingZipWriterOptions = {
  fs: LoggingFileSystemAdapter;
  rootDir: string;
  archivePrefix?: string;
  maxEntryBytes?: number;
  maxArchivedBytes?: number;
  now?: () => Date;
  onError?: (error: unknown) => void;
};

type ArchiveState = {
  tempPath: string;
  finalPath: string;
  replaceFinalOnFinalize: boolean;
  zip: Zip;
  fileWriteQueue: Promise<void>;
  currentEntry: ZipDeflate | null;
  currentEntryPath: string | null;
  currentEntryBytes: number;
};

const DEFAULT_MAX_ENTRY_BYTES = 1024 * 1024;
const DEFAULT_MAX_ARCHIVED_BYTES = 500 * 1024 * 1024;
const BASE64_TABLE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Uint8Array(256).fill(255);
const EMPTY_CHUNK = new Uint8Array(0);

for (let index = 0; index < BASE64_TABLE.length; index += 1) {
  BASE64_LOOKUP[BASE64_TABLE.charCodeAt(index)] = index;
}

function u8ToBase64(input: Uint8Array) {
  let output = '';

  for (let index = 0; index < input.length; index += 3) {
    const byte1 = input[index] ?? 0;
    const byte2 = input[index + 1] ?? 0;
    const byte3 = input[index + 2] ?? 0;
    const combined = byte1 * 65536 + byte2 * 256 + byte3;

    output += BASE64_TABLE[Math.floor(combined / 262144) % 64];
    output += BASE64_TABLE[Math.floor(combined / 4096) % 64];
    output +=
      index + 1 < input.length
        ? BASE64_TABLE[Math.floor(combined / 64) % 64]
        : '=';
    output += index + 2 < input.length ? BASE64_TABLE[combined % 64] : '=';
  }

  return output;
}

function base64ToU8(input: string) {
  const sanitized = input.replace(/\s+/g, '');
  if (!sanitized) {
    return EMPTY_CHUNK;
  }

  const padding =
    (sanitized.endsWith('==') ? 2 : 0) || (sanitized.endsWith('=') ? 1 : 0);
  const output = new Uint8Array(
    Math.floor((sanitized.length * 3) / 4) - padding,
  );
  let outIndex = 0;

  for (let index = 0; index < sanitized.length; index += 4) {
    const code0 = BASE64_LOOKUP[sanitized.charCodeAt(index)] || 0;
    const code1 = BASE64_LOOKUP[sanitized.charCodeAt(index + 1)] || 0;
    const code2 =
      sanitized[index + 2] === '='
        ? 0
        : BASE64_LOOKUP[sanitized.charCodeAt(index + 2)] || 0;
    const code3 =
      sanitized[index + 3] === '='
        ? 0
        : BASE64_LOOKUP[sanitized.charCodeAt(index + 3)] || 0;
    const combined = code0 * 262144 + code1 * 4096 + code2 * 64 + code3;

    output[outIndex++] = Math.floor(combined / 65536) % 256;

    if (sanitized[index + 2] !== '=' && outIndex < output.length) {
      output[outIndex++] = Math.floor(combined / 256) % 256;
    }

    if (sanitized[index + 3] !== '=' && outIndex < output.length) {
      output[outIndex++] = combined % 256;
    }
  }

  return output;
}

export class RollingZipLogWriter {
  readonly rootDir: string;

  private readonly fs: LoggingFileSystemAdapter;
  private readonly archivePrefix: string;
  private readonly maxEntryBytes: number;
  private readonly maxArchivedBytes: number;
  private readonly now: () => Date;
  private readonly onError?: (error: unknown) => void;

  private rootDirReady: Promise<void> | null = null;
  private archiveCounter = 0;
  private entryCounter = 0;
  private currentArchive: ArchiveState | null = null;

  constructor(options: RollingZipWriterOptions) {
    this.fs = options.fs;
    this.rootDir = options.rootDir;
    this.archivePrefix = options.archivePrefix || 'rabby-mobile-logs';
    this.maxEntryBytes = options.maxEntryBytes || DEFAULT_MAX_ENTRY_BYTES;
    this.maxArchivedBytes =
      options.maxArchivedBytes || DEFAULT_MAX_ARCHIVED_BYTES;
    this.now = options.now || (() => new Date());
    this.onError = options.onError;
  }

  private ensureRootDir() {
    if (!this.rootDirReady) {
      this.rootDirReady = this.fs.mkdir(this.rootDir);
    }

    return this.rootDirReady;
  }

  private makeArchiveBaseName(date: Date) {
    return [
      this.archivePrefix,
      formatFileTimestamp(date),
      String(this.archiveCounter++).padStart(3, '0'),
    ].join('-');
  }

  private makeEntryName(date: Date) {
    return [
      'logs',
      formatDateFolder(date),
      `${formatFileTimestamp(date)}-${String(this.entryCounter++).padStart(
        3,
        '0',
      )}.log`,
    ].join('/');
  }

  private isManagedArchiveFile(file: LoggingFileSystemEntry) {
    return (
      file.name.startsWith(this.archivePrefix) &&
      (file.name.endsWith('.zip') || file.name.endsWith('.zip.partial'))
    );
  }

  private isFinalizedManagedArchiveFile(file: LoggingFileSystemEntry) {
    return (
      file.name.startsWith(this.archivePrefix) && file.name.endsWith('.zip')
    );
  }

  private async listManagedArchiveFiles() {
    await this.ensureRootDir();
    return (await this.fs.listFiles(this.rootDir)).filter(file =>
      this.isManagedArchiveFile(file),
    );
  }

  private async pruneOldArchivesIfNeeded(excludePaths: string[] = []) {
    if (this.maxArchivedBytes <= 0) {
      return;
    }

    const excluded = new Set(excludePaths);
    const archivedFiles = (await this.listManagedArchiveFiles())
      .filter(file => this.isFinalizedManagedArchiveFile(file))
      .sort((left, right) => {
        const leftMtime = left.mtimeMs || 0;
        const rightMtime = right.mtimeMs || 0;

        if (leftMtime !== rightMtime) {
          return leftMtime - rightMtime;
        }

        return left.name.localeCompare(right.name);
      });

    let totalBytes = archivedFiles.reduce((sum, file) => sum + file.size, 0);
    let index = 0;

    while (
      totalBytes >= this.maxArchivedBytes &&
      index < archivedFiles.length
    ) {
      const target = archivedFiles[index++];
      if (excluded.has(target.path)) {
        continue;
      }

      await this.fs.unlink(target.path);
      totalBytes -= target.size;
    }
  }

  private async createArchiveState(options: {
    finalPath: string;
    tempPath: string;
    replaceFinalOnFinalize: boolean;
  }) {
    let archiveState: ArchiveState;
    const zip = new Zip((error, chunk) => {
      if (error) {
        this.onError?.(error);
        return;
      }

      if (!chunk || !chunk.length) {
        return;
      }

      archiveState.fileWriteQueue = archiveState.fileWriteQueue.then(() =>
        this.fs.appendFile(options.tempPath, u8ToBase64(chunk), 'base64'),
      );
    });

    archiveState = {
      tempPath: options.tempPath,
      finalPath: options.finalPath,
      replaceFinalOnFinalize: options.replaceFinalOnFinalize,
      zip,
      fileWriteQueue: Promise.resolve(),
      currentEntry: null,
      currentEntryPath: null,
      currentEntryBytes: 0,
    };

    await this.fs.writeFile(options.tempPath, '', 'base64');
    this.currentArchive = archiveState;
    return archiveState;
  }

  private async restoreLatestArchiveIfPossible() {
    const latestArchive = (await this.listManagedArchiveFiles())
      .filter(file => this.isFinalizedManagedArchiveFile(file))
      .sort((left, right) => {
        const rightMtime = right.mtimeMs || 0;
        const leftMtime = left.mtimeMs || 0;

        if (rightMtime !== leftMtime) {
          return rightMtime - leftMtime;
        }

        return right.name.localeCompare(left.name);
      })[0];

    if (!latestArchive) {
      return null;
    }

    try {
      await this.pruneOldArchivesIfNeeded([latestArchive.path]);

      const archivedBase64 = await this.fs.readFile(
        latestArchive.path,
        'base64',
      );
      const archivedEntries = unzipSync(base64ToU8(archivedBase64));
      const entryNames = Object.keys(archivedEntries).sort((left, right) =>
        left.localeCompare(right),
      );
      const logEntryNames = entryNames.filter(name => name.endsWith('.log'));
      const latestEntryPath = logEntryNames[logEntryNames.length - 1] || null;
      const latestEntryBytes = latestEntryPath
        ? (archivedEntries[latestEntryPath] || EMPTY_CHUNK).byteLength
        : 0;
      const continueLatestEntry =
        !!latestEntryPath && latestEntryBytes < this.maxEntryBytes;

      this.entryCounter = Math.max(this.entryCounter, logEntryNames.length);

      const archive = await this.createArchiveState({
        finalPath: latestArchive.path,
        tempPath: `${latestArchive.path}.partial`,
        replaceFinalOnFinalize: true,
      });

      for (const entryName of entryNames) {
        const entryBytes = archivedEntries[entryName] || EMPTY_CHUNK;
        const entry = new ZipDeflate(entryName, {
          level: 6,
        });

        archive.zip.add(entry);

        if (continueLatestEntry && entryName === latestEntryPath) {
          entry.push(entryBytes, false);
          archive.currentEntry = entry;
          archive.currentEntryPath = entryName;
          archive.currentEntryBytes = entryBytes.byteLength;
        } else {
          entry.push(entryBytes, true);
        }

        await archive.fileWriteQueue;
      }

      return archive;
    } catch (error) {
      this.currentArchive = null;
      this.onError?.(error);
      return null;
    }
  }

  private async createArchive() {
    await this.ensureRootDir();
    await this.pruneOldArchivesIfNeeded();

    const now = this.now();
    const baseName = this.makeArchiveBaseName(now);
    const finalPath = `${this.rootDir}/${baseName}.zip`;
    const tempPath = `${finalPath}.partial`;

    return this.createArchiveState({
      finalPath,
      tempPath,
      replaceFinalOnFinalize: false,
    });
  }

  private async ensureArchive() {
    if (this.currentArchive) {
      return this.currentArchive;
    }

    const restoredArchive = await this.restoreLatestArchiveIfPossible();
    if (restoredArchive) {
      return restoredArchive;
    }

    return this.createArchive();
  }

  private async closeCurrentEntry() {
    if (!this.currentArchive?.currentEntry) {
      return;
    }

    this.currentArchive.currentEntry.push(EMPTY_CHUNK, true);
    await this.currentArchive.fileWriteQueue;

    this.currentArchive.currentEntry = null;
    this.currentArchive.currentEntryPath = null;
    this.currentArchive.currentEntryBytes = 0;
  }

  private async ensureEntry(nextLineBytes: number) {
    const archive = await this.ensureArchive();

    if (
      archive.currentEntry &&
      archive.currentEntryBytes > 0 &&
      archive.currentEntryBytes + nextLineBytes > this.maxEntryBytes
    ) {
      await this.closeCurrentEntry();
    }

    if (!archive.currentEntry) {
      await this.pruneOldArchivesIfNeeded([archive.finalPath]);

      const entry = new ZipDeflate(this.makeEntryName(this.now()), {
        level: 6,
      });
      archive.zip.add(entry);
      archive.currentEntry = entry;
      archive.currentEntryPath = entry.filename;
      archive.currentEntryBytes = 0;
    }

    return archive;
  }

  async writeLine(line: string) {
    const lineBytes = strToU8(line);
    const archive = await this.ensureEntry(lineBytes.length);

    archive.currentEntryBytes += lineBytes.length;
    archive.currentEntry?.push(lineBytes, false);

    await archive.fileWriteQueue;
  }

  async flush() {
    await this.currentArchive?.fileWriteQueue;
  }

  async finalizeArchive() {
    const archive = this.currentArchive;
    if (!archive) {
      return null;
    }

    try {
      await this.closeCurrentEntry();
      archive.zip.end();
      await archive.fileWriteQueue;
      if (archive.replaceFinalOnFinalize) {
        await this.fs.unlink(archive.finalPath).catch(() => undefined);
      }
      await this.fs.moveFile(archive.tempPath, archive.finalPath);
      return archive.finalPath;
    } finally {
      this.currentArchive = null;
    }
  }

  getState(): RollingZipWriterState {
    return {
      rootDir: this.rootDir,
      activeArchiveTempPath: this.currentArchive?.tempPath || null,
      activeArchivePath: this.currentArchive?.finalPath || null,
      activeEntryPath: this.currentArchive?.currentEntryPath || null,
      activeEntryBytes: this.currentArchive?.currentEntryBytes || 0,
    };
  }
}
