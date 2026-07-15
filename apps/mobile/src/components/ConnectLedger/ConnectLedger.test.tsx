import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

const mockDevice = {
  id: 'ledger-device-id',
  name: 'Ledger',
};
const mockDevices = [mockDevice];
const mockSearchAndPair = jest.fn();
let mockBluetoothOnNext: (() => void) | undefined;
let mockIsScanning = false;

const mockApiLedger = {
  checkEthApp: jest.fn(),
  connectDevice: jest.fn(),
  connectDeviceById: jest.fn(),
  getCurrentUsedHDPathType: jest.fn(),
  importFirstAddress: jest.fn(),
  setDeviceId: jest.fn(),
  setHDPathType: jest.fn(),
};
const mockHideToast = jest.fn();
const mockNavigateDeprecated = jest.fn();

jest.mock('@/core/apis', () => ({
  apiLedger: mockApiLedger,
}));

jest.mock('@/hooks/ledger/useLedgerImport', () => ({
  useLedgerImport: () => ({
    devices: mockDevices,
    errorCode: undefined,
    searchAndPair: mockSearchAndPair,
  }),
}));

jest.mock('@/hooks/ledger/error', () => ({
  ledgerErrorHandler: jest.fn(),
  LEDGER_ERROR_CODES: {
    FIRMWARE_OR_APP_UPDATE_REQUIRED: 'FIRMWARE_OR_APP_UPDATE_REQUIRED',
    LOCKED_OR_NO_ETH_APP: 'LOCKED_OR_NO_ETH_APP',
  },
}));

jest.mock('@/components2024/Toast', () => ({
  toast: {
    show: jest.fn(),
  },
  toastIndicator: jest.fn(() => mockHideToast),
}));

jest.mock('@/utils/navigation', () => ({
  navigateDeprecated: (...args: unknown[]) => mockNavigateDeprecated(...args),
}));

jest.mock('@/hooks/useShowImportMoreAddressPopup', () => ({
  useShowImportMoreAddressPopup: () => ({
    showImportMorePopup: jest.fn(),
  }),
}));

jest.mock('jotai', () => ({
  useAtom: () => [undefined, jest.fn()],
}));

jest.mock('../HDSetting/MainContainer', () => ({
  isLoadedAtom: {},
  settingAtom: {},
}));

jest.mock('../AutoLockView', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('./BluetoothPermissionScreen', () => ({
  BluetoothPermissionScreen: ({ onNext }: { onNext: () => void }) => {
    mockBluetoothOnNext = onNext;
    return null;
  },
}));

jest.mock('./ScanDeviceScreen', () => ({
  ScanDeviceScreen: () => null,
}));

jest.mock('./NotFoundDeviceScreen', () => ({
  NotFoundDeviceScreen: () => null,
}));

jest.mock('./OpenEthAppScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    OpenEthAppScreen: () => <Text>open-eth-app</Text>,
  };
});

jest.mock('./SelectDeviceScreen', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    SelectDeviceScreen: ({
      devices,
      onSelect,
    }: {
      devices: (typeof mockDevice)[];
      onSelect: (device: typeof mockDevice) => Promise<void>;
    }) => (
      <Pressable
        testID="select-ledger-device"
        onPress={() => onSelect(devices[0])}>
        <Text>select-ledger-device</Text>
      </Pressable>
    ),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@rabby-wallet/eth-keyring-ledger/dist/utils', () => ({
  LedgerHDPathType: {
    LedgerLive: 'LedgerLive',
  },
}));

jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: jest.fn(),
  removeGlobalBottomSheetModal2024: jest.fn(),
}));

jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: {},
}));

jest.mock('@/hooks/account', () => ({}));

const { ConnectLedger } =
  require('./ConnectLedger') as typeof import('./ConnectLedger');

async function pressDevice() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('select-ledger-device'));
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });
}

describe('ConnectLedger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockBluetoothOnNext = undefined;
    mockIsScanning = false;
    mockSearchAndPair.mockImplementation(() => {
      mockIsScanning = true;
    });
    mockApiLedger.connectDeviceById.mockImplementation(async () => {
      mockIsScanning = false;
      throw new Error('known-id connect failed');
    });
    mockApiLedger.connectDevice.mockResolvedValue(undefined);
    mockApiLedger.setDeviceId.mockResolvedValue(undefined);
    mockApiLedger.getCurrentUsedHDPathType.mockResolvedValue('LedgerLive');
    mockApiLedger.setHDPathType.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not let a persisted-id retry stop discovery', async () => {
    render(<ConnectLedger deviceId={mockDevice.id} />);

    await act(async () => {
      mockBluetoothOnNext?.();
      await Promise.resolve();
    });

    expect(mockSearchAndPair).toHaveBeenCalledTimes(1);
    expect(mockApiLedger.connectDeviceById).not.toHaveBeenCalled();
    expect(mockIsScanning).toBe(true);
  });

  it('starts the signer action so it can request opening the Ethereum app', async () => {
    mockApiLedger.checkEthApp.mockImplementation(async callback => {
      callback(false);
      return false;
    });
    mockApiLedger.importFirstAddress.mockResolvedValue(
      '0x0000000000000000000000000000000000000001',
    );

    render(<ConnectLedger />);
    await pressDevice();

    await waitFor(() => {
      expect(mockApiLedger.checkEthApp).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockApiLedger.importFirstAddress).toHaveBeenCalledWith({
        retryCount: 5,
      });
    });
  });

  it('returns to device selection when the signer action fails', async () => {
    mockApiLedger.checkEthApp
      .mockImplementationOnce(async callback => {
        callback(false);
        return false;
      })
      .mockImplementation(async callback => {
        callback(true);
        return true;
      });
    mockApiLedger.importFirstAddress
      .mockRejectedValueOnce(new Error('Device session not found'))
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000001');

    render(<ConnectLedger />);

    await pressDevice();
    await waitFor(() => {
      expect(mockApiLedger.importFirstAddress).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('select-ledger-device')).toBeTruthy();

    await pressDevice();
    await waitFor(() => {
      expect(mockApiLedger.importFirstAddress).toHaveBeenCalledTimes(2);
    });
  });
});
