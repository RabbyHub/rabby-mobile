function loadRabbyPointsModule(
  persistedStore:
    | {
        signatures: Record<string, string>;
      }
    | undefined = undefined,
) {
  jest.resetModules();

  const mockCreatePersistStore = jest.fn(() => persistedStore);

  jest.doMock('@rabby-wallet/persist-store', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockCreatePersistStore(...args),
  }));
  jest.doMock('@/core/storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      RabbyPoints: 'RabbyPoints',
    },
  }));

  const { RabbyPointsService } =
    require('./rabbyPoints') as typeof import('./rabbyPoints');

  return {
    RabbyPointsService,
    mocks: {
      mockCreatePersistStore,
    },
  };
}

describe('core/services/rabbyPoints', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('stores, reads, and clears signatures case-insensitively by address', () => {
    const { RabbyPointsService } = loadRabbyPointsModule();
    const service = new RabbyPointsService();

    service.setSignature('0xABC', 'signature');

    expect(service.store.signatures).toEqual({
      '0xabc': 'signature',
    });
    expect(service.getSignature('0xAbC')).toBe('signature');

    service.clearSignatureByAddr('0xABC');

    expect(service.getSignature('0xabc')).toBeUndefined();
    expect(service.store.signatures).toEqual({});
  });

  it('uses persisted signatures when storage returns an existing store and can clear all', () => {
    const persistedStore = {
      signatures: {
        '0xabc': 'signature',
      },
    };
    const { RabbyPointsService } = loadRabbyPointsModule(persistedStore);
    const service = new RabbyPointsService();

    expect(service.getSignature('0xABC')).toBe('signature');

    service.clearSignature();

    expect(service.store.signatures).toEqual({});
  });
});
