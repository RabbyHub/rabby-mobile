const mockCheckDeviceSecurityRisk = jest.fn<Promise<boolean>, []>();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockAlert = jest.fn();
const mockTranslate = jest.fn((key: string) => key);

jest.mock('react-native', () => ({
  Alert: {
    alert: (...args: unknown[]) => mockAlert(...args),
  },
}));

jest.mock('@/core/native/RNHelpers', () => ({
  __esModule: true,
  default: {
    checkDeviceSecurityRisk: () => mockCheckDeviceSecurityRisk(),
  },
}));

jest.mock('@/core/storage/mmkv', () => ({
  appStorage: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => mockTranslate(key),
  },
}));

import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import { showDeviceSecurityRiskWarningIfNeeded } from './deviceSecurityRisk';

const ACKNOWLEDGED_KEY =
  APP_MMKV_WEAK_KEYS.DEVICE_SECURITY_WARNING_ACKNOWLEDGED;

describe('showDeviceSecurityRiskWarningIfNeeded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockReturnValue(null);
    mockCheckDeviceSecurityRisk.mockResolvedValue(false);
  });

  it('skips detection after the user has acknowledged the warning', async () => {
    mockGetItem.mockReturnValue(true);

    await showDeviceSecurityRiskWarningIfNeeded();

    expect(mockGetItem).toHaveBeenCalledWith(ACKNOWLEDGED_KEY);
    expect(mockCheckDeviceSecurityRisk).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('does not warn when the native check reports no risk', async () => {
    await showDeviceSecurityRiskWarningIfNeeded();

    expect(mockCheckDeviceSecurityRisk).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('shows a non-cancelable warning and persists acknowledgment on confirm', async () => {
    mockCheckDeviceSecurityRisk.mockResolvedValue(true);

    await showDeviceSecurityRiskWarningIfNeeded();

    expect(mockAlert).toHaveBeenCalledWith(
      'global.deviceSecurityRisk.title',
      'global.deviceSecurityRisk.message',
      expect.any(Array),
      { cancelable: false },
    );

    const buttons = mockAlert.mock.calls[0][2] as {
      text: string;
      onPress: () => void;
    }[];
    expect(buttons[0].text).toBe('global.confirm');

    buttons[0].onPress();

    expect(mockSetItem).toHaveBeenCalledWith(ACKNOWLEDGED_KEY, true);
  });

  it('silently ignores native check failures', async () => {
    mockCheckDeviceSecurityRisk.mockRejectedValue(new Error('unavailable'));

    await expect(showDeviceSecurityRiskWarningIfNeeded()).resolves.toBe(
      undefined,
    );
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
