import { strToU8, Zip, ZipDeflate } from 'fflate';
import { formatDateFolder, formatFileTimestamp } from './format';

export interface LoggingFileSystemAdapter {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, contents: string, encoding: 'base64'): Promise<void>;
  appendFile(path: string, contents: string, encoding: 'base64'): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
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
  now?: () => Date;
  onError?: (error: unknown) => void;
};

type ArchiveState = {
  tempPath: string;
  finalPath: string;
  zip: Zip;
  fileWriteQueue: Promise<void>;
  currentEntry: ZipDeflate | null;
  currentEntryPath: string | null;
  currentEntryBytes: number;
};

const DEFAULT_MAX_ENTRY_BYTES = 1024 * 1024;
const BASE64_TABLE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const EMPTY_CHUNK = new Uint8Array(0);

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

export class RollingZipLogWriter {
  readonly rootDir: string;

  private readonly fs: LoggingFileSystemAdapter;
  private readonly archivePrefix: string;
  private readonly maxEntryBytes: number;
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

  private async createArchive() {
    await this.ensureRootDir();

    const now = this.now();
    const baseName = this.makeArchiveBaseName(now);
    const finalPath = `${this.rootDir}/${baseName}.zip`;
    const tempPath = `${finalPath}.partial`;

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
        this.fs.appendFile(tempPath, u8ToBase64(chunk), 'base64'),
      );
    });

    archiveState = {
      tempPath,
      finalPath,
      zip,
      fileWriteQueue: Promise.resolve(),
      currentEntry: null,
      currentEntryPath: null,
      currentEntryBytes: 0,
    };

    await this.fs.writeFile(tempPath, '', 'base64');

    this.currentArchive = archiveState;
    return archiveState;
  }

  private async ensureArchive() {
    if (this.currentArchive) {
      return this.currentArchive;
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
