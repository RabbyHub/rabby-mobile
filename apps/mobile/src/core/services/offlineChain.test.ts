function loadOfflineChainModule({
  isNonPublicProductionEnv,
  persistedStore,
}: {
  isNonPublicProductionEnv: boolean;
  persistedStore?: {
    closeTipsChains: string[];
  };
}) {
  jest.resetModules();

  class MockStoreServiceBase {
    private store: { closeTipsChains: string[] };

    constructor(_storeName: string, template: { closeTipsChains: string[] }) {
      this.store = persistedStore || template;
    }

    protected mutateStore(
      recipe: (draft: { closeTipsChains: string[] }) => void,
    ) {
      recipe(this.store);
    }

    getStoreFieldSnapshot(key: 'closeTipsChains') {
      return [...this.store[key]];
    }
  }

  jest.doMock('@rabby-wallet/persist-store', () => ({
    __esModule: true,
    StoreServiceBase: MockStoreServiceBase,
  }));
  jest.doMock('@/core/storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      offlineChain: 'offlineChain',
    },
  }));
  jest.doMock('@/constant', () => ({
    isNonPublicProductionEnv,
  }));

  const { OfflineChainService } =
    require('./offlineChain') as typeof import('./offlineChain');

  return {
    OfflineChainService,
  };
}

describe('core/services/offlineChain', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('appends closed-tip chains to the persisted list', () => {
    const { OfflineChainService } = loadOfflineChainModule({
      isNonPublicProductionEnv: false,
      persistedStore: {
        closeTipsChains: ['eth'],
      },
    });
    const service = new OfflineChainService();

    service.setCloseTipsChains(['arb', 'base']);

    expect(service.getCloseTipsChains()).toEqual(['eth', 'arb', 'base']);
  });

  it('only allows mock clearing closed-tip chains in non-public production environments', () => {
    const publicEnv = loadOfflineChainModule({
      isNonPublicProductionEnv: false,
      persistedStore: {
        closeTipsChains: ['eth'],
      },
    });
    const publicService = new publicEnv.OfflineChainService();

    publicService.mockClearCloseTipsChains();

    expect(publicService.getCloseTipsChains()).toEqual(['eth']);

    const nonPublicEnv = loadOfflineChainModule({
      isNonPublicProductionEnv: true,
      persistedStore: {
        closeTipsChains: ['eth'],
      },
    });
    const nonPublicService = new nonPublicEnv.OfflineChainService();

    nonPublicService.mockClearCloseTipsChains();

    expect(nonPublicService.getCloseTipsChains()).toEqual([]);
  });
});
