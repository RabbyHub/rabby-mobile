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
