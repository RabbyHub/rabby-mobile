import type { StorageAdapater } from '@rabby-wallet/persist-store';

import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

import { RabbyPointsService, type RabbyPointsStore } from './rabbyPoints';

const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

// Only replace the storage boundary. Service mutations, snapshots, listeners,
// and persistence scheduling all use the real persist-store implementation.
function createStorage(initialStore?: RabbyPointsStore) {
  const values = new Map<string, unknown>();
  if (initialStore) {
    values.set(APP_STORE_NAMES.RabbyPoints, clone(initialStore));
  }
  const storage: StorageAdapater = {
    getItem: key => clone(values.get(String(key))),
    setItem: (key, value) => {
      values.set(String(key), clone(value));
    },
    removeItem: key => {
      values.delete(String(key));
    },
    clearAll: () => values.clear(),
  };
  return storage;
}

describe('RabbyPoints signature persistence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('clears the same signature regardless of address casing', () => {
    const service = new RabbyPointsService({
      storageAdapter: createStorage(),
    });
    service.setSignature('0xAbC', 'fixture-signature');
    expect(service.getSignature('0xABC')).toBe('fixture-signature');

    service.clearSignatureByAddr('0xABC');

    expect(service.getSignature('0xabc')).toBeUndefined();
    expect(service.getStoreSnapshot().signatures).toEqual({});
  });

  it('persists removal of one address without clearing another address', () => {
    const storageAdapter = createStorage({
      signatures: {
        '0xabc': 'fixture-signature-a',
        '0xdef': 'fixture-signature-b',
      },
    });
    const service = new RabbyPointsService({ storageAdapter });
    const listener = jest.fn();
    const unsubscribe = service.subscribeStoreField('signatures', listener);
    try {
      service.clearSignatureByAddr('0xAbC');
      service.flushStore();

      const rehydrated = new RabbyPointsService({ storageAdapter });
      expect(rehydrated.getSignature('0xABC')).toBeUndefined();
      expect(rehydrated.getSignature('0xDEF')).toBe('fixture-signature-b');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toEqual({
        '0xdef': 'fixture-signature-b',
      });
    } finally {
      unsubscribe();
    }
  });

  it('overwrites a normalized key and persists clearing all signatures', () => {
    const storageAdapter = createStorage();
    const service = new RabbyPointsService({ storageAdapter });
    service.setSignature('0xABC', 'fixture-old');
    service.setSignature('0xabc', 'fixture-new');
    service.setSignature('0xDEF', 'fixture-other');
    service.flushStore();

    const rehydrated = new RabbyPointsService({ storageAdapter });
    expect(rehydrated.getStoreSnapshot().signatures).toEqual({
      '0xabc': 'fixture-new',
      '0xdef': 'fixture-other',
    });
    rehydrated.clearSignature();
    rehydrated.flushStore();
    expect(
      new RabbyPointsService({ storageAdapter }).getStoreSnapshot().signatures,
    ).toEqual({});
  });

  it('does not remove another signature when an address is absent', () => {
    const service = new RabbyPointsService({
      storageAdapter: createStorage({
        signatures: { '0xabc': 'fixture-signature' },
      }),
    });

    service.clearSignatureByAddr('0xDEF');

    expect(service.getSignature('0xABC')).toBe('fixture-signature');
  });
});
