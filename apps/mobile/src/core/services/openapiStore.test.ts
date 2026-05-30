type OpenApiStoreState = {
  api: {
    host: string;
  };
  apiKey: string | null;
  apiTime: number | null;
};

function createState(
  state: Partial<OpenApiStoreState> = {},
): OpenApiStoreState {
  return {
    api: {
      host: 'https://initial.example',
      ...state.api,
    },
    apiKey: null,
    apiTime: null,
    ...state,
  };
}

function loadOpenApiStoreModule(storesForConstructors: OpenApiStoreState[]) {
  jest.resetModules();

  const stores = [
    createState({
      apiKey: 'singleton-key',
      apiTime: 1,
    }),
    ...storesForConstructors,
  ];
  const mockCreatePersistStore = jest.fn(() => stores.shift());
  const mockUuidV4 = jest.fn(() => 'generated-api-key');

  jest.doMock('@/constant', () => ({
    INITIAL_OPENAPI_URL: 'https://api.rabby.test',
  }));
  jest.doMock('@rabby-wallet/persist-store', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockCreatePersistStore(...args),
  }));
  jest.doMock('../storage/mmkv', () => ({
    appStorage: {
      name: 'mock-storage',
    },
  }));
  jest.doMock('../storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      notificationOpenapi: 'notificationOpenapi',
      openapi: 'openapi',
    },
  }));
  jest.doMock('uuid', () => ({
    v4: (...args: unknown[]) => mockUuidV4(...args),
  }));

  const { OpenApiStore } =
    require('./openapiStore') as typeof import('./openapiStore');

  return {
    OpenApiStore,
    mocks: {
      mockCreatePersistStore,
      mockUuidV4,
    },
  };
}

describe('core/services/openapiStore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('generates an API key and timestamp when the persisted store has no key', () => {
    jest.spyOn(Date, 'now').mockReturnValue(12_345_000);
    const storeState = createState({
      apiKey: null,
      apiTime: null,
    });
    const { OpenApiStore, mocks } = loadOpenApiStoreModule([storeState]);

    const store = new OpenApiStore({
      name: 'notificationOpenapi' as never,
    });

    expect(store.apiKey).toBe('generated-api-key');
    expect(store.apiTime).toBe(12_345);
    expect(mocks.mockCreatePersistStore).toHaveBeenLastCalledWith(
      {
        name: 'notificationOpenapi',
        template: {
          api: {
            host: 'https://api.rabby.test',
          },
          apiKey: null,
          apiTime: null,
        },
      },
      {
        storage: undefined,
      },
    );
  });

  it('preserves existing store values and exposes host, key, and time setters', () => {
    const storeState = createState({
      api: {
        host: 'https://persisted.example',
      },
      apiKey: 'persisted-key',
      apiTime: 10,
    });
    const { OpenApiStore, mocks } = loadOpenApiStoreModule([storeState]);

    const store = new OpenApiStore();

    expect(store.host).toBe('https://persisted.example');
    expect(store.apiKey).toBe('persisted-key');
    expect(store.apiTime).toBe(10);
    expect(mocks.mockUuidV4).not.toHaveBeenCalled();

    store.host = 'https://next.example';
    store.apiKey = 'next-key';
    store.apiTime = 20;

    expect(store.store).toEqual({
      api: {
        host: 'https://next.example',
      },
      apiKey: 'next-key',
      apiTime: 20,
    });
  });
});
