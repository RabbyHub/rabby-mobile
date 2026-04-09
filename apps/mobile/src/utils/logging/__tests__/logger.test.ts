import { strFromU8, unzipSync } from 'fflate';
import { AppLogger } from '../core';
import { MaskedLogValue, serializeLogValue } from '../format';
import {
  LoggingFileSystemAdapter,
  RollingZipLogWriter,
} from '../rollingZipWriter';

class MemoryFS implements LoggingFileSystemAdapter {
  private readonly files = new Map<string, Buffer>();

  async mkdir(_path: string) {}

  async writeFile(path: string, contents: string, encoding: 'base64') {
    this.files.set(path, Buffer.from(contents, encoding));
  }

  async appendFile(path: string, contents: string, encoding: 'base64') {
    const current = this.files.get(path) || Buffer.alloc(0);
    const next = Buffer.concat([current, Buffer.from(contents, encoding)]);
    this.files.set(path, next);
  }

  async moveFile(from: string, to: string) {
    const value = this.files.get(from);
    if (!value) {
      throw new Error(`File not found: ${from}`);
    }

    this.files.set(to, value);
    this.files.delete(from);
  }

  has(path: string) {
    return this.files.has(path);
  }

  read(path: string) {
    const value = this.files.get(path);
    if (!value) {
      throw new Error(`File not found: ${path}`);
    }

    return value;
  }

  listPaths() {
    return Array.from(this.files.keys()).sort();
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
});
