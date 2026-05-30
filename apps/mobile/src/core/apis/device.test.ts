const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockUuidV4 = jest.fn();
const mockGetUniqueIdSync = jest.fn();
const mockGetSystemVersion = jest.fn();
const mockGetSystemName = jest.fn();

jest.mock('@/constant', () => ({
  APP_VERSIONS: {
    fromNative: '1.2.3',
    buildNumber: '456',
  },
  APPLICATION_ID: 'com.rabby.mobile',
}));

jest.mock('@/constant/env', () => ({
  BUILD_GIT_INFO: {
    BUILD_GIT_HASH: 'abc123',
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

jest.mock('react-native-device-info', () => ({
  getUniqueIdSync: (...args: unknown[]) => mockGetUniqueIdSync(...args),
  getSystemVersion: (...args: unknown[]) => mockGetSystemVersion(...args),
  getSystemName: (...args: unknown[]) => mockGetSystemName(...args),
}));

jest.mock('uuid', () => ({
  v4: (...args: unknown[]) => mockUuidV4(...args),
}));

jest.mock('../storage/mmkv', () => ({
  appJsonStore: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

import {
  ensureDeviceUUID,
  makeDeviceUUID,
  makeMobileClientPushInfo,
} from './device';

describe('core/apis/device', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockReturnValue('persisted-uuid');
    mockUuidV4.mockReturnValue('new-uuid');
    mockGetUniqueIdSync.mockReturnValue('native-unique-id');
    mockGetSystemVersion.mockReturnValue('14');
    mockGetSystemName.mockReturnValue('Android');
  });

  it('reuses an existing persisted device uuid', () => {
    expect(ensureDeviceUUID()).toBe('persisted-uuid');
    expect(mockGetItem).toHaveBeenCalledWith('rabbymobile_uuid', null);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('generates and persists a uuid when none exists', () => {
    mockGetItem.mockReturnValue(null);

    expect(ensureDeviceUUID()).toBe('new-uuid');
    expect(mockSetItem).toHaveBeenCalledWith('rabbymobile_uuid', 'new-uuid');
  });

  it('combines persisted uuid, platform, and native unique id', () => {
    expect(makeDeviceUUID()).toEqual({
      uniqId: 'native-unique-id',
      deviceUUID: 'persisted-uuid-android-native-unique-id',
    });
  });

  it('builds mobile push client info from native and build metadata', () => {
    expect(makeMobileClientPushInfo('push-token', true)).toEqual({
      deviceUUID: 'persisted-uuid-android-native-unique-id',
      platform: 'android',
      packageName: 'com.rabby.mobile',
      systemVersion: '14',
      systemName: 'Android',
      appVersion: '1.2.3',
      appBuildNumber: '456',
      appBuildRevision: 'abc123',
      enabledNotifications: true,
      pushToken: 'push-token',
    });
  });
});
