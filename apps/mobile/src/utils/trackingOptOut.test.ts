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

function loadTrackingOptOut(preference?: Record<string, unknown>) {
  jest.resetModules();
  mockNativeHelpers();

  const { appStorage } =
    require('@/core/storage/mmkv') as typeof import('@/core/storage/mmkv');
  const { APP_STORE_NAMES } =
    require('@/core/storage/storeConstant') as typeof import('@/core/storage/storeConstant');

  appStorage.clearAll();
  if (preference) {
    appStorage.setItem(APP_STORE_NAMES.preference, preference);
  }

  const trackingOptOut =
    require('./trackingOptOut') as typeof import('./trackingOptOut');

  return {
    appStorage,
    APP_STORE_NAMES,
    ...trackingOptOut,
  };
}

describe('trackingOptOut', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@/core/native/RNHelpers');
    jest.dontMock('react-native-haptic-feedback');
  });

  it('defaults to opt-out when preference has not been created', () => {
    const { getUserBehaviorTrackingOptOut } = loadTrackingOptOut();

    expect(getUserBehaviorTrackingOptOut()).toBe(true);
  });

  it('defaults existing preference without the field to opt-in', () => {
    const { getUserBehaviorTrackingOptOut } = loadTrackingOptOut({
      locale: 'en',
    });

    expect(getUserBehaviorTrackingOptOut()).toBe(false);
  });

  it('uses the persisted opt-out value when present', () => {
    let trackingOptOut = loadTrackingOptOut({
      userBehaviorTrackingOptOut: true,
    });
    expect(trackingOptOut.getUserBehaviorTrackingOptOut()).toBe(true);

    trackingOptOut = loadTrackingOptOut({
      userBehaviorTrackingOptOut: false,
    });
    expect(trackingOptOut.getUserBehaviorTrackingOptOut()).toBe(false);
  });

  it('lets runtime cache override stale persisted preference', () => {
    const {
      getUserBehaviorTrackingOptOut,
      setUserBehaviorTrackingOptOutCache,
    } = loadTrackingOptOut({
      userBehaviorTrackingOptOut: true,
    });

    setUserBehaviorTrackingOptOutCache(false);

    expect(getUserBehaviorTrackingOptOut()).toBe(false);
  });
});
