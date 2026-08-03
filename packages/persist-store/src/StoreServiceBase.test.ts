import * as sinon from 'sinon';

import type { StorageAdapater } from './storageAdapter';
import { StoreServiceBase } from './StoreServiceBase';

describe('StoreServiceBase', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('persists the latest store value and flushes immediately', () => {
    const storage: StorageAdapater = {
      getItem: sinon.stub().returns(null),
      setItem: sinon.stub(),
      removeItem: sinon.stub(),
      clearAll: sinon.stub(),
      flushToDisk: sinon.stub(),
    };
    const service = new StoreServiceBase(
      'settings',
      { enabled: false },
      { storageAdapter: storage },
    );

    service.store.enabled = true;
    service.persistStoreImmediately();

    expect(
      (storage.setItem as sinon.SinonStub).calledWith('settings', {
        enabled: true,
      }),
    ).toBe(true);
    expect((storage.flushToDisk as sinon.SinonStub).calledOnce).toBe(true);
  });
});
