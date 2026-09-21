function loadDeviceModule({
  existingUUID,
  platform = 'android',
}: {
  existingUUID?: string | null;
  platform?: 'android' | 'ios';
} = {}) {
  jest.resetModules();

  let storedUUID = existingUUID ?? null;
  const mockGetItem = jest.fn(() => storedUUID);
  const mockSetItem = jest.fn((_key: string, value: string) => {
    storedUUID = value;
  });
  const mockUuidV4 = jest.fn(() => 'generated-uuid');
  const mockGetUniqueIdSync = jest.fn(() => 'device-unique-id');
  const mockGetSystemName = jest.fn(() => 'Android');
  const mockGetSystemVersion = jest.fn(() => '15');

  jest.doMock('react-native', () => ({
    Platform: {
      OS: platform,
    },
  }));
  jest.doMock('react-native-device-info', () => ({
    __esModule: true,
    default: {
      getSystemName: (...args: unknown[]) => mockGetSystemName(...args),
      getSystemVersion: (...args: unknown[]) => mockGetSystemVersion(...args),
      getUniqueIdSync: (...args: unknown[]) => mockGetUniqueIdSync(...args),
    },
  }));
  jest.doMock('uuid', () => ({
    v4: (...args: unknown[]) => mockUuidV4(...args),
  }));
  jest.doMock('@/constant', () => ({
    APPLICATION_ID: 'com.rabby.mobile.test',
    APP_VERSIONS: {
      buildNumber: '99',
      fromNative: '1.2.3',
    },
  }));
  jest.doMock('@/constant/env', () => ({
    BUILD_GIT_INFO: {
      BUILD_GIT_HASH: 'abcdef0',
    },
  }));
  jest.doMock('../storage/mmkv', () => ({
    appJsonStore: {
      getItem: (...args: unknown[]) => mockGetItem(...args),
      setItem: (...args: unknown[]) => mockSetItem(...args),
    },
  }));

  const deviceModule = require('./device') as typeof import('./device');

  return {
    ...deviceModule,
    mocks: {
      mockGetItem,
      mockGetSystemName,
      mockGetSystemVersion,
      mockGetUniqueIdSync,
      mockSetItem,
      mockUuidV4,
    },
  };
}

describe('core/apis/device', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('returns an existing persisted UUID without generating a new one', () => {
    const { ensureDeviceUUID, mocks } = loadDeviceModule({
      existingUUID: 'persisted-uuid',
    });

    expect(ensureDeviceUUID()).toBe('persisted-uuid');
    expect(mocks.mockGetItem).toHaveBeenCalledWith('rabbymobile_uuid', null);
    expect(mocks.mockUuidV4).not.toHaveBeenCalled();
    expect(mocks.mockSetItem).not.toHaveBeenCalled();
  });

  it('generates and persists a UUID when no device UUID exists', () => {
    const { ensureDeviceUUID, mocks } = loadDeviceModule();

    expect(ensureDeviceUUID()).toBe('generated-uuid');
    expect(mocks.mockSetItem).toHaveBeenCalledWith(
      'rabbymobile_uuid',
      'generated-uuid',
    );
  });

  it('combines persisted app UUID, platform, and hardware unique id', () => {
    const { makeDeviceUUID } = loadDeviceModule({
      existingUUID: 'persisted-uuid',
      platform: 'ios',
    });

    expect(makeDeviceUUID()).toEqual({
      deviceUUID: 'persisted-uuid-ios-device-unique-id',
      uniqId: 'device-unique-id',
    });
  });

  it('builds the mobile client push info payload from app and device metadata', () => {
    const { makeMobileClientPushInfo } = loadDeviceModule({
      existingUUID: 'persisted-uuid',
      platform: 'ios',
    });

    expect(makeMobileClientPushInfo('push-token', true)).toEqual({
      appBuildNumber: '99',
      appBuildRevision: 'abcdef0',
      appVersion: '1.2.3',
      deviceUUID: 'persisted-uuid-ios-device-unique-id',
      enabledNotifications: true,
      packageName: 'com.rabby.mobile.test',
      platform: 'ios',
      pushToken: 'push-token',
      systemName: 'Android',
      systemVersion: '15',
    });
  });
});
