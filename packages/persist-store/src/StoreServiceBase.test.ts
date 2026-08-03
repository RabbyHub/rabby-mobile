import * as sinon from 'sinon';

import type { StorageAdapater } from './storageAdapter';
import { StoreServiceBase } from './StoreServiceBase';

class SettingsService extends StoreServiceBase<
  { enabled: boolean },
  'settings'
> {
  setEnabled(value: boolean) {
    this.mutateStore(draft => {
      draft.enabled = value;
    });
  }
}

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
    const service = new SettingsService(
      'settings',
      { enabled: false },
      { storageAdapter: storage },
    );

    service.setEnabled(true);
    service.flushStore();

    expect(
      (storage.setItem as sinon.SinonStub).calledWith('settings', {
        enabled: true,
      }),
    ).toBe(true);
    expect((storage.flushToDisk as sinon.SinonStub).calledOnce).toBe(true);
  });
});
