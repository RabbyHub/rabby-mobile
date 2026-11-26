import { createHmac, timingSafeEqual } from 'node:crypto';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
import {
  createConfigIntegrity,
  type ConfigIntegrityRuntime,
} from './coordinator';
import {
  CONFIG_INTEGRITY_KEY,
  registry,
  type Diagnostic,
  type Registry,
} from './schema';

export const TEST_HMAC_KEY = '11'.repeat(32);
export const sign = (key: string, input: string) =>
  createHmac('sha256', Buffer.from(key, 'hex')).update(input).digest('hex');

export function createFixture() {
  const disk = new Map<string, string>();
  const events: (Diagnostic | string)[] = [];
  let key: string | null = null;
  let failWrite: string | undefined;
  const storage: StorageAdapater = {
    getItem(name) {
      const value = disk.get(name);
      return value === undefined ? null : JSON.parse(value);
    },
    setItem(name, value) {
      if (name === failWrite) {
        throw new Error('disk write failed');
      }
      disk.set(String(name), JSON.stringify(value));
      events.push(String(name));
    },
    removeItem: name => disk.delete(String(name)),
    clearAll: () => disk.clear(),
  };
  const keychain = {
    read: jest.fn(async () => key),
    create: jest.fn(async (value: string) => {
      key = value;
      events.push('keychain:create');
    }),
    update: jest.fn(async (value: string) => {
      key = value;
      events.push('keychain:update');
    }),
  };
  const runtime: ConfigIntegrityRuntime = {
    keychain,
    generateKey: jest.fn(() => TEST_HMAC_KEY),
    sign: jest.fn(sign),
    matches: (first, second) =>
      timingSafeEqual(Buffer.from(first, 'hex'), Buffer.from(second, 'hex')),
    report: diagnostic => events.push(diagnostic),
  };

  function process(protectedRegistry: Registry = registry) {
    return createConfigIntegrity(
      protectedRegistry,
      {
        has: name => disk.has(name),
        read: name => disk.get(name),
        writeMetadata: metadata =>
          storage.setItem(CONFIG_INTEGRITY_KEY, metadata),
      },
      storage,
    );
  }
  const start = async (protectedRegistry?: Registry) => {
    const observer = process(protectedRegistry);
    await observer.start(runtime);
    return observer;
  };

  return {
    disk,
    events,
    storage,
    runtime,
    keychain,
    start,
    process,
    diagnostics: () =>
      events.filter((event): event is Diagnostic => typeof event !== 'string'),
    setKey: (value: string | null) => {
      key = value;
    },
    getKey: () => (key === null ? null : JSON.parse(key)),
    failWritesFor: (name?: string) => {
      failWrite = name;
    },
  };
}
