import { strFromU8, unzipSync } from 'fflate';
import {
  AppLogger,
  MaskedLogValue,
  RollingZipLogWriter,
  serializeLogValue,
} from '@rabby-wallet/rabby-logger';
import type {
  LoggingFileSystemAdapter,
  LoggingFileSystemEntry,
} from '@rabby-wallet/rabby-logger';

class MemoryFS implements LoggingFileSystemAdapter {
  protected readonly files = new Map<
    string,
    {
      contents: Buffer;
      mtimeMs: number;
    }
  >();
  protected clock = 1;

  async mkdir(_path: string) {}

  async readFile(path: string, encoding: 'base64') {
    return this.read(path).toString(encoding);
  }

  async writeFile(path: string, contents: string, encoding: 'base64') {
    this.files.set(path, {
      contents: Buffer.from(contents, encoding),
      mtimeMs: this.clock++,
    });
  }

  async appendFile(path: string, contents: string, encoding: 'base64') {
    const current = this.files.get(path);
    const next = Buffer.concat([
      current?.contents || Buffer.alloc(0),
      Buffer.from(contents, encoding),
    ]);
    this.files.set(path, {
      contents: next,
      mtimeMs: this.clock++,
    });
  }

  async moveFile(from: string, to: string) {
    const value = this.files.get(from);
    if (!value) {
      throw new Error(`File not found: ${from}`);
    }

    this.files.set(to, {
      contents: value.contents,
      mtimeMs: this.clock++,
    });
    this.files.delete(from);
  }

  async listFiles(path: string): Promise<LoggingFileSystemEntry[]> {
    const prefix = `${path.replace(/\/+$/, '')}/`;

    return Array.from(this.files.entries())
      .filter(([filePath]) => filePath.startsWith(prefix))
      .map(([filePath, file]) => ({
        name: filePath.slice(prefix.length),
        path: filePath,
        size: file.contents.length,
        mtimeMs: file.mtimeMs,
      }));
  }

  async unlink(path: string) {
    this.files.delete(path);
  }

  has(path: string) {
    return this.files.has(path);
  }

  read(path: string) {
    const value = this.files.get(path);
    if (!value) {
      throw new Error(`File not found: ${path}`);
    }

    return value.contents;
  }

  seedFile(path: string, contents: string, mtimeMs = this.clock++) {
    this.files.set(path, {
      contents: Buffer.from(contents),
      mtimeMs,
    });
  }

  listPaths() {
    return Array.from(this.files.keys()).sort();
  }
}

class NativeBytesMemoryFS extends MemoryFS {
  readFileCalls = 0;
  writeFileCalls = 0;
  appendFileCalls = 0;
  readFileBytesCalls = 0;
  writeFileBytesCalls = 0;
  appendFileBytesCalls = 0;

  resetStats() {
    this.readFileCalls = 0;
    this.writeFileCalls = 0;
    this.appendFileCalls = 0;
    this.readFileBytesCalls = 0;
    this.writeFileBytesCalls = 0;
    this.appendFileBytesCalls = 0;
  }

  override async readFile(path: string, encoding: 'base64') {
    this.readFileCalls += 1;
    return super.readFile(path, encoding);
  }

  override async writeFile(path: string, contents: string, encoding: 'base64') {
    this.writeFileCalls += 1;
    return super.writeFile(path, contents, encoding);
  }

  override async appendFile(
    path: string,
    contents: string,
    encoding: 'base64',
  ) {
    this.appendFileCalls += 1;
    return super.appendFile(path, contents, encoding);
  }

  async readFileBytes(path: string) {
    this.readFileBytesCalls += 1;
    return new Uint8Array(this.read(path));
  }

  async writeFileBytes(path: string, contents: Uint8Array) {
    this.writeFileBytesCalls += 1;
    this.files.set(path, {
      contents: Buffer.from(contents),
      mtimeMs: this.clock++,
    });
  }

  async appendFileBytes(path: string, contents: Uint8Array) {
    this.appendFileBytesCalls += 1;
    const current = this.files.get(path);
    const next = Buffer.concat([
      current?.contents || Buffer.alloc(0),
      Buffer.from(contents),
    ]);
    this.files.set(path, {
      contents: next,
      mtimeMs: this.clock++,
    });
  }
}

function makeNowSequence(...values: string[]) {
  let index = 0;

  return () => new Date(values[Math.min(index++, values.length - 1)]);
}

function readArchiveEntries(fs: MemoryFS, archivePath: string) {
  const archive = unzipSync(new Uint8Array(fs.read(archivePath)));

  return Object.fromEntries(
    Object.entries(archive)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, strFromU8(value)]),
  );
}

describe('logging format', () => {
  it('masks nested values and keeps circular references safe', () => {
    const circular: Record<string, unknown> = { visible: 1 };
    circular.self = circular;

    expect(
      serializeLogValue(
        new MaskedLogValue({
          secret: 'token-123',
          nested: ['alpha', { beta: 'gamma' }],
        }),
      ),
    ).toEqual({
      secret: '*********',
      nested: ['*****', { beta: '*****' }],
    });

    expect(serializeLogValue(circular)).toEqual({
      visible: 1,
      self: '[Circular]',
    });
  });
});

describe('rolling zip log writer', () => {
  it('rotates entries at the configured max size and finalizes a zip file', async () => {
    const fs = new MemoryFS();
    const writer = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 18,
      now: makeNowSequence(
        '2026-04-09T12:00:00.000Z',
        '2026-04-09T12:00:00.001Z',
        '2026-04-09T12:00:00.002Z',
        '2026-04-09T12:00:00.003Z',
      ),
    });

    await writer.writeLine('line-01\n');
    await writer.writeLine('line-02-is-long\n');
    await writer.writeLine('line-03\n');

    const archivePath = await writer.finalizeArchive();

    expect(archivePath).not.toBeNull();
    expect(fs.has(archivePath as string)).toBe(true);

    const entries = readArchiveEntries(fs, archivePath as string);
    expect(Object.keys(entries)).toHaveLength(3);
    expect(Object.values(entries)).toEqual([
      'line-01\n',
      'line-02-is-long\n',
      'line-03\n',
    ]);
  });

  it('prunes the oldest archived zip files before opening a new log file', async () => {
    const fs = new MemoryFS();
    fs.seedFile('/applogs/test-log-older.zip', '123', 1);
    fs.seedFile('/applogs/test-log-newer.zip', '456', 2);

    const writer = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxArchivedBytes: 5,
      now: makeNowSequence('2026-04-09T13:00:00.000Z'),
    });

    await writer.writeLine('line-01\n');

    expect(fs.has('/applogs/test-log-older.zip')).toBe(false);
    expect(fs.has('/applogs/test-log-newer.zip')).toBe(true);
    expect(fs.listPaths().some(path => path.endsWith('.zip.partial'))).toBe(
      true,
    );
  });

  it('reuses the latest finalized zip and keeps appending to the recent log file', async () => {
    const fs = new MemoryFS();
    const seedWriter = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 64,
      now: makeNowSequence(
        '2026-04-09T14:00:00.000Z',
        '2026-04-09T14:00:00.001Z',
      ),
    });

    await seedWriter.writeLine('line-01\n');
    const seedArchivePath = await seedWriter.finalizeArchive();

    const writer = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 64,
      now: makeNowSequence(
        '2026-04-09T14:05:00.000Z',
        '2026-04-09T14:05:00.001Z',
      ),
    });

    await writer.writeLine('line-02\n');
    const archivePath = await writer.finalizeArchive();

    expect(archivePath).toBe(seedArchivePath);

    const entries = readArchiveEntries(fs, archivePath as string);
    expect(Object.keys(entries)).toHaveLength(1);
    expect(Object.values(entries)).toEqual(['line-01\nline-02\n']);
  });

  it('reuses the latest finalized zip and opens a new log file when the recent one is full', async () => {
    const fs = new MemoryFS();
    const seedWriter = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 6,
      now: makeNowSequence(
        '2026-04-09T14:10:00.000Z',
        '2026-04-09T14:10:00.001Z',
      ),
    });

    await seedWriter.writeLine('12345\n');
    const seedArchivePath = await seedWriter.finalizeArchive();

    const writer = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 6,
      now: makeNowSequence(
        '2026-04-09T14:11:00.000Z',
        '2026-04-09T14:11:00.001Z',
        '2026-04-09T14:11:00.002Z',
      ),
    });

    await writer.writeLine('xx\n');
    const archivePath = await writer.finalizeArchive();

    expect(archivePath).toBe(seedArchivePath);

    const entries = readArchiveEntries(fs, archivePath as string);
    expect(Object.keys(entries)).toHaveLength(2);
    expect(Object.values(entries)).toEqual(['12345\n', 'xx\n']);
  });

  it('uses native byte file methods when they are available', async () => {
    const fs = new NativeBytesMemoryFS();
    const seedWriter = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 64,
      now: makeNowSequence(
        '2026-04-09T14:15:00.000Z',
        '2026-04-09T14:15:00.001Z',
      ),
    });

    await seedWriter.writeLine('line-01\n');
    const seedArchivePath = await seedWriter.finalizeArchive();
    fs.resetStats();

    const writer = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 64,
      now: makeNowSequence(
        '2026-04-09T14:16:00.000Z',
        '2026-04-09T14:16:00.001Z',
      ),
    });

    await writer.writeLine('line-02\n');
    const archivePath = await writer.finalizeArchive();

    expect(archivePath).toBe(seedArchivePath);
    expect(fs.readFileBytesCalls).toBeGreaterThan(0);
    expect(fs.writeFileBytesCalls).toBeGreaterThan(0);
    expect(fs.appendFileBytesCalls).toBeGreaterThan(0);
    expect(fs.readFileCalls).toBe(0);
    expect(fs.writeFileCalls).toBe(0);
    expect(fs.appendFileCalls).toBe(0);

    const entries = readArchiveEntries(fs, archivePath as string);
    expect(Object.values(entries)).toEqual(['line-01\nline-02\n']);
  });

  it('can start a new archive without restoring the latest finalized zip', async () => {
    const fs = new MemoryFS();
    const seedWriter = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 64,
      now: makeNowSequence('2026-04-09T14:20:00.000Z'),
    });

    await seedWriter.writeLine('line-01\n');
    const seedArchivePath = await seedWriter.finalizeArchive();
    const readFileSpy = jest.spyOn(fs, 'readFile');

    const writer = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'test-log',
      maxEntryBytes: 64,
      restoreLatestArchive: false,
      now: makeNowSequence('2026-04-09T14:25:00.000Z'),
    });

    await writer.writeLine('line-02\n');
    const archivePath = await writer.finalizeArchive();

    expect(archivePath).not.toBe(seedArchivePath);
    expect(readFileSpy).not.toHaveBeenCalledWith(seedArchivePath, 'base64');

    expect(
      Object.values(readArchiveEntries(fs, seedArchivePath as string)),
    ).toEqual(['line-01\n']);
    expect(
      Object.values(readArchiveEntries(fs, archivePath as string)),
    ).toEqual(['line-02\n']);
  });
});

describe('app logger', () => {
  it('writes masked records and closes the archive when policy turns off', async () => {
    const fs = new MemoryFS();
    let enabled = true;
    const inMemoryEntries: { message: string; data: unknown }[] = [];
    const writer = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'app-log',
      now: makeNowSequence(
        '2026-04-09T12:30:00.000Z',
        '2026-04-09T12:30:00.100Z',
        '2026-04-09T12:30:00.200Z',
      ),
    });
    const logger = new AppLogger({
      runtimeEnv: 'regression',
      platform: 'ios',
      writer,
      shouldWriteToFile: () => enabled,
      sessionId: 'session-test',
      captureInMemory: true,
      onInMemoryLog(entry) {
        inMemoryEntries.push({
          message: entry.message,
          data: entry.data,
        });
      },
      originalConsole: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        time: jest.fn(),
        timeLog: jest.fn(),
        timeEnd: jest.fn(),
        assert: jest.fn(),
      },
    });

    logger.info('login payload', {
      accessToken: logger.mask('secret-access-token'),
      nested: {
        privateKey: logger.mask('very-secret-key'),
      },
    });

    await logger.flush();

    enabled = false;
    const archivePath = await logger.handlePolicyChange();

    expect(archivePath).toBeUndefined();

    const finalizedPath = writer.getState().activeArchivePath;
    expect(finalizedPath).toBeNull();

    const savedArchivePath = fs.listPaths().find(path => path.endsWith('.zip'));
    expect(savedArchivePath).toBeDefined();

    const entries = readArchiveEntries(fs, savedArchivePath as string);
    const archiveBody = Object.values(entries).join('\n');

    expect(archiveBody).toContain('@rabby-log/v1');
    expect(archiveBody).not.toContain('secret-access-token');
    expect(archiveBody).not.toContain('very-secret-key');
    expect(archiveBody).toContain('"accessToken":"*******************"');
    expect(inMemoryEntries).toHaveLength(1);
    expect(inMemoryEntries[0]?.message).toContain('login payload');
  });

  it('captures console output only after console capture is enabled', async () => {
    const fs = new MemoryFS();
    let writeEnabled = false;
    let consoleCaptureEnabled = false;
    const writer = new RollingZipLogWriter({
      fs,
      rootDir: '/applogs',
      archivePrefix: 'app-log',
      now: makeNowSequence(
        '2026-04-09T12:40:00.000Z',
        '2026-04-09T12:40:00.100Z',
        '2026-04-09T12:40:00.200Z',
      ),
    });
    const originalConsole = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      time: jest.fn(),
      timeLog: jest.fn(),
      timeEnd: jest.fn(),
      assert: jest.fn(),
    };
    const consoleTarget = {
      ...originalConsole,
    };
    const logger = new AppLogger({
      runtimeEnv: 'regression',
      platform: 'ios',
      writer,
      shouldWriteToFile: () => writeEnabled,
      shouldCaptureConsole: () => consoleCaptureEnabled,
      sessionId: 'session-console-test',
      originalConsole,
    });

    logger.installConsoleCapture(consoleTarget);

    consoleTarget.log('console before enable', { visible: true });
    await logger.flush();

    expect(originalConsole.log).toHaveBeenNthCalledWith(
      1,
      'console before enable',
      { visible: true },
    );
    expect(fs.listPaths().filter(path => path.endsWith('.zip'))).toHaveLength(
      0,
    );

    writeEnabled = true;
    consoleCaptureEnabled = true;

    consoleTarget.log('console after enable', {
      accessToken: logger.mask('secret-access-token'),
    });

    await logger.finalizeArchive();

    const savedArchivePath = fs.listPaths().find(path => path.endsWith('.zip'));
    expect(savedArchivePath).toBeDefined();

    const entries = readArchiveEntries(fs, savedArchivePath as string);
    const archiveBody = Object.values(entries).join('\n');

    expect(archiveBody).toContain('console after enable');
    expect(archiveBody).not.toContain('console before enable');
    expect(archiveBody).not.toContain('secret-access-token');
  });
});
