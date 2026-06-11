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

const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

function loadSentryModule(
  preference: Record<string, unknown>,
  options: { dev?: boolean } = {},
) {
  jest.resetModules();
  mockNativeHelpers();
  (globalThis as { __DEV__?: boolean }).__DEV__ = options.dev ?? false;

  jest.doMock('@/constant', () => ({
    APP_VERSIONS: {
      forSentry: '1.0.0-test',
    },
  }));
  jest.doMock('@/constant/env', () => ({
    SENTRY_DEBUG: false,
    getSentryEnv: () => 'test',
  }));

  const { appStorage } =
    require('@/core/storage/mmkv') as typeof import('@/core/storage/mmkv');
  const { APP_STORE_NAMES } =
    require('@/core/storage/storeConstant') as typeof import('@/core/storage/storeConstant');

  appStorage.clearAll();
  appStorage.setItem(APP_STORE_NAMES.preference, preference);

  const sentry =
    require('@sentry/react-native') as typeof import('@sentry/react-native');
  const sentryModule = require('./sentry') as typeof import('./sentry');

  return {
    sentry,
    sentryModule,
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
