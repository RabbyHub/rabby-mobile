import type { StorageAdapater } from '@rabby-wallet/persist-store';

// This integration test intentionally constructs the real business service.
/* eslint-disable no-runtime-service-imports */
import { RabbyPointsService } from '@/core/services/rabbyPoints';
/* eslint-enable no-runtime-service-imports */

function createSerializedMemoryStorage() {
  const values = new Map<string, string>();
  const writes: string[] = [];

  const storage: StorageAdapater = {
    getItem: key => {
      const value = values.get(String(key));
      return value === undefined ? null : JSON.parse(value);
    },
    setItem: (key, value) => {
      writes.push(String(key));
      values.set(String(key), JSON.stringify(value));
    },
    removeItem: key => {
      values.delete(String(key));
    },
    clearAll: () => {
      values.clear();
    },
  };

  return {
    storage,
    getWriteCount: () => writes.length,
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('persisted business service lifecycle integration', () => {
  it('coalesces writes and reconstructs a new service from persisted state', async () => {
    const { storage, getWriteCount } = createSerializedMemoryStorage();
    const firstService = new RabbyPointsService({
      storageAdapter: storage,
    });
    const changes: string[][] = [];
    const unsubscribe = firstService.subscribeStore(change => {
      changes.push([...change.changedKeys]);
    });

    expect(getWriteCount()).toBe(1);

    firstService.setSignature('0xAbC', 'signature-a');
    firstService.setSignature('0xDef', 'signature-b');

    expect(firstService.getSignature('0xabc')).toBe('signature-a');
    expect(firstService.getSignature('0xDEF')).toBe('signature-b');
    expect(changes).toEqual([['signatures'], ['signatures']]);
    expect(getWriteCount()).toBe(1);

    await flushMicrotasks();
    expect(getWriteCount()).toBe(2);

    const reconstructedService = new RabbyPointsService({
      storageAdapter: storage,
    });

    expect(reconstructedService.getStoreSnapshot()).toEqual({
      signatures: {
        '0xabc': 'signature-a',
        '0xdef': 'signature-b',
      },
    });

    reconstructedService.clearSignatureByAddr('0xabc');
    reconstructedService.persistStoreImmediately();

    const thirdService = new RabbyPointsService({
      storageAdapter: storage,
    });
    expect(thirdService.getStoreSnapshot()).toEqual({
      signatures: {
        '0xdef': 'signature-b',
      },
    });

    unsubscribe();
  });
});
