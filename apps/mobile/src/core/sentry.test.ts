type SentryModule = typeof import('./sentry');
type SentryEvent = Parameters<SentryModule['shouldDropSentryEvent']>[0];
type SentryEventHint = NonNullable<
  Parameters<SentryModule['shouldDropSentryEvent']>[1]
>;

function mockNativeHelpers() {
  jest.doMock('react-native-haptic-feedback', () => ({
    trigger: jest.fn(),
  }));
  jest.doMock('@/core/native/RNHelpers', () => ({
    __esModule: true,
    default: {
      iosExcludeFileFromBackup: jest.fn(() => Promise.resolve(true)),
    },
  }));
}

function mockSentryConstants(version = '1.0.0-test') {
  jest.doMock('@/constant', () => ({
    APP_VERSIONS: {
      forSentry: version,
    },
  }));
  jest.doMock('@/constant/env', () => ({
    SENTRY_DEBUG: false,
    getSentryEnv: () => 'test',
  }));
}

const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

function loadSentryModule(
  preference: Record<string, unknown>,
  options: { dev?: boolean } = {},
) {
  jest.resetModules();
  mockNativeHelpers();
  mockSentryConstants();
  (globalThis as { __DEV__?: boolean }).__DEV__ = options.dev ?? false;

  const { appStorage } =
    require('@/core/storage/mmkv') as typeof import('@/core/storage/mmkv');
  const { APP_STORE_NAMES } =
    require('@/core/storage/storeConstant') as typeof import('@/core/storage/storeConstant');

  appStorage.clearAll();
  appStorage.setItem(APP_STORE_NAMES.preference, preference);

  const sentry =
    require('@sentry/react-native') as typeof import('@sentry/react-native');
  const sentryModule = require('./sentry') as SentryModule;

  return {
    sentry,
    sentryModule,
  };
}

function loadSentryFilterModule() {
  jest.resetModules();
  mockNativeHelpers();
  mockSentryConstants('0.0.0-test');
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;

  return require('./sentry') as SentryModule;
}

function makeEvent(message: string): SentryEvent {
  return {
    message,
  };
}

describe('core/sentry', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    jest.dontMock('@/core/native/RNHelpers');
    jest.dontMock('react-native-haptic-feedback');
    jest.dontMock('@/constant');
    jest.dontMock('@/constant/env');
  });

  it('does not initialize while opted out', () => {
    const { sentry, sentryModule } = loadSentryModule({
      userBehaviorTrackingOptOut: true,
    });

    sentryModule.initSentry();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('does not initialize in dev builds', () => {
    const { sentry, sentryModule } = loadSentryModule(
      {
        userBehaviorTrackingOptOut: false,
      },
      { dev: true },
    );

    sentryModule.initSentry();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('initializes enabled and keeps events when tracking is allowed', () => {
    const { sentry, sentryModule } = loadSentryModule({
      userBehaviorTrackingOptOut: false,
    });

    sentryModule.initSentry();

    const options = (sentry.init as jest.Mock).mock.calls[0][0];
    const event = { event_id: 'event-id' };

    expect(options.enabled).toBe(true);
    expect(options.enableAutoSessionTracking).toBe(true);
    expect(options.beforeBreadcrumb(event)).toBe(event);
    expect(options.beforeSend(event)).toBe(event);
    expect(options.beforeSendTransaction(event)).toBe(event);
  });

  it('drops filtered errors through beforeSend while tracking is allowed', () => {
    const { sentry, sentryModule } = loadSentryModule({
      userBehaviorTrackingOptOut: false,
    });

    sentryModule.initSentry();

    const options = (sentry.init as jest.Mock).mock.calls[0][0];

    expect(options.beforeSend(makeEvent('Network Error'))).toBeNull();
  });

  it('initializes on sync when tracking becomes allowed', () => {
    const { sentry, sentryModule } = loadSentryModule({
      userBehaviorTrackingOptOut: false,
    });

    sentryModule.syncSentryUserBehaviorTrackingEnabled();

    expect(sentry.init).toHaveBeenCalledTimes(1);
  });

  it('syncs an initialized client enabled state from preference', () => {
    const { sentry, sentryModule } = loadSentryModule({
      userBehaviorTrackingOptOut: true,
    });
    const options = { enabled: true, enableAutoSessionTracking: true };
    const close = jest.fn(() => Promise.resolve());

    (sentry.getClient as jest.Mock).mockReturnValue({
      getOptions: () => options,
    });
    (sentry as typeof sentry & { close: typeof close }).close = close;

    sentryModule.syncSentryUserBehaviorTrackingEnabled();

    expect(options.enabled).toBe(false);
    expect(options.enableAutoSessionTracking).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('sentry filtering', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    jest.dontMock('@/core/native/RNHelpers');
    jest.dontMock('react-native-haptic-feedback');
    jest.dontMock('@/constant');
    jest.dontMock('@/constant/env');
  });

  it.each([
    'device is inactive, please activate it first',
    'device not found',
    'Network request failed',
    'Network Error',
    'Network request timed out',
    'Request timeout',
    'Request timed out',
    'Request failed with status code 503',
    'timeout exceeded',
    'AxiosError: timeout exceeded',
    'Failed to connect',
    '[connectFeService] Empty push token, cannot connect to push server',
    "You've already added this chain",
    'Billing is unavailable. This may be a problem with your device, or the Play Store may be down.',
    'Stop loss cancel errorerror: {}',
  ])('drops known noisy exception: %s', message => {
    const { shouldDropSentryEvent } = loadSentryFilterModule();

    expect(shouldDropSentryEvent(makeEvent(message))).toBe(true);
  });

  it('drops known noisy exception values', () => {
    const { shouldDropSentryEvent } = loadSentryFilterModule();

    expect(
      shouldDropSentryEvent({
        exception: {
          values: [
            {
              type: 'AxiosError',
              value: 'Network Error',
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it('drops errors with http protocol text', () => {
    const { shouldDropSentryEvent } = loadSentryFilterModule();

    expect(
      shouldDropSentryEvent(
        makeEvent('Request failed for https://api.rabby.io/v1/test'),
      ),
    ).toBe(true);

    expect(
      shouldDropSentryEvent({
        exception: {
          values: [
            {
              type: 'Error',
              value: 'Request timeout',
              stacktrace: {
                frames: [
                  {
                    filename:
                      '@rabby-wallet/hyperliquid-sdk/dist/client/http-client',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it('drops synthetic event objects captured as exceptions', () => {
    const { shouldDropSentryEvent } = loadSentryFilterModule();
    const hint: SentryEventHint = {
      originalException: {
        _bubbles: true,
        _cancelable: true,
        _composed: true,
      },
    };

    expect(
      shouldDropSentryEvent(
        {
          exception: {
            values: [
              {
                type: 'apply',
                value:
                  'Object captured as exception with keys: _bubbles, _cancelable, _composed',
              },
            ],
          },
        },
        hint,
      ),
    ).toBe(true);
  });

  it('keeps unrelated errors', () => {
    const { shouldDropSentryEvent } = loadSentryFilterModule();

    expect(
      shouldDropSentryEvent(makeEvent('Unexpected database failure')),
    ).toBe(false);
  });
});

const ADDRESS = '0x1234567890abcdef1234567890ABCDEF12345678';
const OTHER_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const TX_HASH = `0x${'ab'.repeat(32)}`;

describe('sentry scrubbing', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
    jest.dontMock('@/core/native/RNHelpers');
    jest.dontMock('react-native-haptic-feedback');
    jest.dontMock('@/constant');
    jest.dontMock('@/constant/env');
  });

  function loadInitOptions() {
    const { sentry, sentryModule } = loadSentryModule({
      userBehaviorTrackingOptOut: false,
    });
    sentryModule.initSentry();
    return {
      options: (sentry.init as jest.Mock).mock.calls[0][0],
      sentryModule,
    };
  }

  it('strips query strings from XHR breadcrumbs without mutating the input', () => {
    const { options, sentryModule } = loadInitOptions();
    const breadcrumb = {
      category: 'xhr',
      type: 'http',
      data: {
        method: 'GET',
        url: `https://api.rabby.io/v1/user/total_balance?id=${ADDRESS}`,
        'http.query': `?id=${ADDRESS}`,
        status_code: 200,
      },
    };

    const scrubbed = options.beforeBreadcrumb(breadcrumb);

    expect(scrubbed).toEqual({
      category: 'xhr',
      type: 'http',
      data: {
        method: 'GET',
        url: 'https://api.rabby.io/v1/user/total_balance',
        status_code: 200,
      },
    });
    expect(breadcrumb.data.url).toContain(ADDRESS);
    expect(breadcrumb.data['http.query']).toBe(`?id=${ADDRESS}`);
    expect(JSON.stringify(scrubbed)).not.toContain(ADDRESS);
    expect(sentryModule.SENTRY_REDACTED_ADDRESS).toBe('0x[redacted]');
  });

  it('redacts addresses in console breadcrumb arguments without touching live objects', () => {
    const { options } = loadInitOptions();
    const account = { address: ADDRESS, type: 'HdKeyring' };
    const breadcrumb = {
      category: 'console',
      message: `load balance ${ADDRESS}`,
      data: { arguments: ['load balance', account], logger: 'console' },
    };

    const scrubbed = options.beforeBreadcrumb(breadcrumb);

    expect(scrubbed.message).toBe('load balance 0x[redacted]');
    expect(scrubbed.data.arguments[1]).toEqual({
      address: '0x[redacted]',
      type: 'HdKeyring',
    });
    expect(account.address).toBe(ADDRESS);
  });

  it('redacts addresses and URL queries across a captured event', () => {
    const { options } = loadInitOptions();
    const extra = {
      scene: 'perps',
      account: { address: ADDRESS },
      balances: { [ADDRESS]: 1, [OTHER_ADDRESS]: 2 },
      error: new Error(`insufficient funds: address ${ADDRESS} have 0`),
      request: `GET https://api.rabby.io/v1/user?id=${ADDRESS} 500`,
    };
    const event = {
      message: `Load balance failed for ${ADDRESS}`,
      exception: {
        values: [{ type: 'Error', value: `Address ${ADDRESS} not found` }],
      },
      tags: { owner: ADDRESS },
      extra,
      breadcrumbs: [
        {
          category: 'xhr',
          data: { url: `https://api.rabby.io/v1/wallet?user_addr=${ADDRESS}` },
        },
      ],
    };

    const scrubbed = options.beforeSend(event);
    const serialized = JSON.stringify(scrubbed);

    expect(serialized).not.toContain(ADDRESS);
    expect(serialized).not.toContain(OTHER_ADDRESS);
    expect(serialized).not.toContain('user_addr');
    expect(scrubbed.message).toBe('Load balance failed for 0x[redacted]');
    expect(scrubbed.extra.request).toBe('GET https://api.rabby.io/v1/user 500');
    expect(scrubbed.exception.values[0].value).toBe(
      'Address 0x[redacted] not found',
    );
    expect(scrubbed.extra.error.message).toBe(
      'insufficient funds: address 0x[redacted] have 0',
    );
    expect(Object.keys(scrubbed.extra.balances)).toEqual([
      '0x[redacted]',
      '0x[redacted]#2',
    ]);
    expect(extra.account.address).toBe(ADDRESS);
  });

  it('strips span URL queries from transactions', () => {
    const { options } = loadInitOptions();
    const transaction = {
      type: 'transaction',
      transaction: 'Home',
      spans: [
        {
          op: 'http.client',
          description: 'GET https://api.rabby.io/v1/user/total_balance',
          data: {
            url: `https://api.rabby.io/v1/user/total_balance?id=${ADDRESS}`,
            'http.url': `https://api.rabby.io/v1/user/total_balance?id=${ADDRESS}`,
            'http.query': `?id=${ADDRESS}`,
          },
        },
      ],
    };

    const scrubbed = options.beforeSendTransaction(transaction);

    expect(scrubbed.spans[0].data).toEqual({
      url: 'https://api.rabby.io/v1/user/total_balance',
      'http.url': 'https://api.rabby.io/v1/user/total_balance',
    });
  });

  it('keeps unchanged payloads, longer hex values and cycles intact', () => {
    const { sentryModule } = loadInitOptions();
    const clean = { message: `tx ${TX_HASH}`, extra: { count: 1 } };
    const cyclic: Record<string, unknown> = { address: ADDRESS };
    cyclic.self = cyclic;

    expect(sentryModule.scrubSentryPayload(clean)).toBe(clean);
    expect(
      (sentryModule.scrubSentryPayload(cyclic) as Record<string, unknown>)
        .address,
    ).toBe('0x[redacted]');
  });

  it('turns off native network breadcrumbs that bypass the JS hooks', () => {
    const { options } = loadInitOptions();

    expect(options.enableNetworkBreadcrumbs).toBe(false);
  });
});
