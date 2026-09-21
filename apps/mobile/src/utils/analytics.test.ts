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

function loadAnalytics(preference: Record<string, unknown>) {
  jest.resetModules();
  mockNativeHelpers();

  const logEventMock = jest.fn().mockResolvedValue(undefined);
  const logScreenViewMock = jest.fn().mockResolvedValue(undefined);
  const setAnalyticsCollectionEnabledMock = jest
    .fn()
    .mockResolvedValue(undefined);
  const analyticsFactoryMock = jest.fn(() => ({
    logEvent: logEventMock,
    logScreenView: logScreenViewMock,
    setAnalyticsCollectionEnabled: setAnalyticsCollectionEnabledMock,
  }));

  jest.doMock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    default: analyticsFactoryMock,
  }));
  jest.doMock('nanoid', () => ({
    customAlphabet: () => () => '1234567890abcdef',
    nanoid: () => 'rand-id',
  }));

  const { appStorage } =
    require('@/core/storage/mmkv') as typeof import('@/core/storage/mmkv');
  const { APP_STORE_NAMES } =
    require('@/core/storage/storeConstant') as typeof import('@/core/storage/storeConstant');

  appStorage.clearAll();
  appStorage.setItem(APP_STORE_NAMES.preference, preference);

  const analyticsModule =
    require('./analytics') as typeof import('./analytics');

  return {
    analyticsModule,
    appStorage,
    APP_STORE_NAMES,
    logEventMock,
    logScreenViewMock,
    setAnalyticsCollectionEnabledMock,
  };
}

describe('analytics', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
    jest.dontMock('@react-native-firebase/analytics');
    jest.dontMock('@/core/native/RNHelpers');
    jest.dontMock('react-native-haptic-feedback');
    jest.dontMock('nanoid');
  });

  it('does not send GA or Matomo events while opted out', async () => {
    const {
      analyticsModule,
      logEventMock,
      logScreenViewMock,
      setAnalyticsCollectionEnabledMock,
    } = loadAnalytics({
      userBehaviorTrackingOptOut: true,
    });

    await analyticsModule.matomoRequestEvent({
      category: 'Test Event',
      action: 'Click',
    });
    await analyticsModule.analytics.logScreenView({
      screen_name: 'Home',
      screen_class: 'Home',
    });

    expect(setAnalyticsCollectionEnabledMock).toHaveBeenCalledWith(false);
    expect(logEventMock).not.toHaveBeenCalled();
    expect(logScreenViewMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends GA and Matomo events when tracking is allowed', async () => {
    const {
      analyticsModule,
      appStorage,
      APP_STORE_NAMES,
      logEventMock,
      setAnalyticsCollectionEnabledMock,
    } = loadAnalytics({
      userBehaviorTrackingOptOut: false,
    });

    await analyticsModule.matomoRequestEvent({
      category: 'Test Event',
      action: 'Click',
    });

    expect(setAnalyticsCollectionEnabledMock).toHaveBeenCalledWith(true);
    expect(logEventMock).toHaveBeenCalledWith('Test_Event', {
      category: 'Test Event',
      action: 'Click',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      'https://matomo.debank.com/matomo.php?',
    );
    expect(appStorage.getItem(APP_STORE_NAMES.preference)).toMatchObject({
      extensionId: '1234567890abcdef',
      userBehaviorTrackingOptOut: false,
    });
  });
});
