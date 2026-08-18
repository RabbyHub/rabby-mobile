const mockCheckDeviceSecurityRisk = jest.fn<Promise<boolean>, []>();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockCreateGlobalBottomSheetModal = jest.fn();
const mockRemoveGlobalBottomSheetModal = jest.fn();
const mockTranslate = jest.fn((key: string) => key);

jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: {
    SIMPLE_CONFIRM: 'SIMPLE_CONFIRM',
  },
}));

jest.mock('@/core/serviceApi/appWin', () => ({
  apisAppWin2024: {
    createGlobalBottomSheetModal: (...args: unknown[]) =>
      mockCreateGlobalBottomSheetModal(...args),
    removeGlobalBottomSheetModal: (...args: unknown[]) =>
      mockRemoveGlobalBottomSheetModal(...args),
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
    mockCreateGlobalBottomSheetModal.mockReturnValue('SIMPLE_CONFIRM_test');
    mockRemoveGlobalBottomSheetModal.mockResolvedValue(undefined);
  });

  it('skips detection after the user has acknowledged the warning', async () => {
    mockGetItem.mockReturnValue(true);

    await showDeviceSecurityRiskWarningIfNeeded();

    expect(mockGetItem).toHaveBeenCalledWith(ACKNOWLEDGED_KEY);
    expect(mockCheckDeviceSecurityRisk).not.toHaveBeenCalled();
    expect(mockCreateGlobalBottomSheetModal).not.toHaveBeenCalled();
  });

  it('does not warn when the native check reports no risk', async () => {
    await showDeviceSecurityRiskWarningIfNeeded();

    expect(mockCheckDeviceSecurityRisk).toHaveBeenCalledTimes(1);
    expect(mockCreateGlobalBottomSheetModal).not.toHaveBeenCalled();
  });

  it('disables gesture dismissal and persists acknowledgment on confirm', async () => {
    mockCheckDeviceSecurityRisk.mockResolvedValue(true);

    await showDeviceSecurityRiskWarningIfNeeded();

    expect(mockCreateGlobalBottomSheetModal).toHaveBeenCalledWith({
      name: 'SIMPLE_CONFIRM',
      title: 'global.deviceSecurityRisk.title',
      description: 'global.deviceSecurityRisk.message',
      confirmText: 'global.confirm',
      onConfirm: expect.any(Function),
      bottomSheetModalProps: {
        enableDynamicSizing: true,
        enablePanDownToClose: false,
        backdropProps: { pressBehavior: 'none' },
      },
    });

    mockCreateGlobalBottomSheetModal.mock.calls[0][0].onConfirm();

    expect(mockSetItem).toHaveBeenCalledWith(ACKNOWLEDGED_KEY, true);
    expect(mockRemoveGlobalBottomSheetModal).toHaveBeenCalledWith(
      'SIMPLE_CONFIRM_test',
    );
  });

  it('silently ignores native check failures', async () => {
    mockCheckDeviceSecurityRisk.mockRejectedValue(new Error('unavailable'));

    await expect(showDeviceSecurityRiskWarningIfNeeded()).resolves.toBe(
      undefined,
    );
    expect(mockCreateGlobalBottomSheetModal).not.toHaveBeenCalled();
  });
});
