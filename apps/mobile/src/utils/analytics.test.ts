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

  const logScreenViewMock = jest.fn().mockResolvedValue(undefined);
  const setAnalyticsCollectionEnabledMock = jest
    .fn()
    .mockResolvedValue(undefined);
  const analyticsFactoryMock = jest.fn(() => ({
    logScreenView: logScreenViewMock,
    setAnalyticsCollectionEnabled: setAnalyticsCollectionEnabledMock,
  }));

  jest.doMock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    default: analyticsFactoryMock,
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
    logScreenViewMock,
    setAnalyticsCollectionEnabledMock,
  };
}

describe('analytics', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@react-native-firebase/analytics');
    jest.dontMock('@/core/native/RNHelpers');
    jest.dontMock('react-native-haptic-feedback');
  });

  it('does not send GA screen views while opted out', async () => {
    const {
      analyticsModule,
      logScreenViewMock,
      setAnalyticsCollectionEnabledMock,
    } = loadAnalytics({
      userBehaviorTrackingOptOut: true,
    });

    await analyticsModule.analytics.logScreenView({
      screen_name: 'Home',
      screen_class: 'Home',
    });

    expect(setAnalyticsCollectionEnabledMock).toHaveBeenCalledWith(false);
    expect(logScreenViewMock).not.toHaveBeenCalled();
  });

  it('sends GA screen views when tracking is allowed', async () => {
    const {
      analyticsModule,
      logScreenViewMock,
      setAnalyticsCollectionEnabledMock,
    } = loadAnalytics({
      userBehaviorTrackingOptOut: false,
    });

    await analyticsModule.analytics.logScreenView({
      screen_name: 'Home',
      screen_class: 'Home',
    });

    expect(setAnalyticsCollectionEnabledMock).toHaveBeenCalledWith(true);
    expect(logScreenViewMock).toHaveBeenCalledWith({
      screen_name: 'Home',
      screen_class: 'Home',
    });
  });

  it('only exposes screen view reporting', () => {
    const { analyticsModule } = loadAnalytics({
      userBehaviorTrackingOptOut: false,
    });

    expect(Object.keys(analyticsModule.analytics)).toEqual(['logScreenView']);
    expect(analyticsModule).not.toHaveProperty('matomoRequestEvent');
  });
});
