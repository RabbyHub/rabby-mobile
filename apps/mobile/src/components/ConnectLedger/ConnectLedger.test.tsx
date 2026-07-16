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
let mockLedgerErrorCode: string | undefined;

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
const mockToastShow = jest.fn();
const mockLedgerErrorHandler = jest.fn();
const mockNavigateDeprecated = jest.fn();

jest.mock('@/core/apis', () => ({
  apiLedger: mockApiLedger,
}));

jest.mock('@/hooks/ledger/useLedgerImport', () => ({
  useLedgerImport: () => ({
    devices: mockDevices,
    errorCode: mockLedgerErrorCode,
    searchAndPair: mockSearchAndPair,
  }),
}));

jest.mock('@/hooks/ledger/error', () => ({
  ledgerErrorHandler: (...args: unknown[]) => mockLedgerErrorHandler(...args),
  LEDGER_ERROR_CODES: {
    FIRMWARE_OR_APP_UPDATE_REQUIRED: 'FIRMWARE_OR_APP_UPDATE_REQUIRED',
    LOCKED_OR_NO_ETH_APP: 'LOCKED_OR_NO_ETH_APP',
    NO_ETH_APP: 'NO_ETH_APP',
    BLUETOOTH_PERMISSION_DENIED: 'bluetooth_permission_denied',
    BLUETOOTH_POWERED_OFF: 'bluetooth_powered_off',
  },
}));

jest.mock('@/components2024/Toast', () => ({
  toast: {
    show: (...args: unknown[]) => mockToastShow(...args),
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
    const React = require('react');
    const { Text } = require('react-native');
    mockBluetoothOnNext = onNext;
    return <Text>bluetooth-permission-screen</Text>;
  },
}));

jest.mock('./ScanDeviceScreen', () => ({
  ScanDeviceScreen: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return <Text>scan-device-screen</Text>;
  },
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
    mockLedgerErrorCode = undefined;
    mockSearchAndPair.mockImplementation(() => {
      mockIsScanning = true;
    });
    mockApiLedger.connectDeviceById.mockImplementation(async () => {
      mockIsScanning = false;
      throw new Error('known-id connect failed');
    });
    mockApiLedger.checkEthApp.mockResolvedValue(true);
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

  it.each(['bluetooth_permission_denied', 'bluetooth_powered_off'])(
    'returns to the Bluetooth step after %s',
    async errorCode => {
      const { rerender } = render(<ConnectLedger />);

      act(() => mockBluetoothOnNext?.());
      expect(screen.getByText('scan-device-screen')).toBeTruthy();

      mockLedgerErrorCode = errorCode;
      rerender(<ConnectLedger />);

      await waitFor(() => {
        expect(screen.getByText('bluetooth-permission-screen')).toBeTruthy();
      });

      act(() => jest.runOnlyPendingTimers());
      expect(screen.getByText('bluetooth-permission-screen')).toBeTruthy();
    },
  );

  it('does not continue signing when the readiness probe fails', async () => {
    const onSelectDevice = jest.fn();
    mockApiLedger.checkEthApp.mockRejectedValueOnce(
      new Error('Ledger device is locked'),
    );

    render(<ConnectLedger onSelectDevice={onSelectDevice} />);
    await pressDevice();

    await waitFor(() => {
      expect(mockApiLedger.checkEthApp).toHaveBeenCalledTimes(1);
    });
    expect(onSelectDevice).not.toHaveBeenCalled();
  });

  it('surfaces an eager connection failure and allows retry', async () => {
    const onSelectDevice = jest.fn();
    mockApiLedger.connectDevice.mockRejectedValueOnce(
      new Error('Failed to open Ledger'),
    );

    render(<ConnectLedger onSelectDevice={onSelectDevice} />);
    await pressDevice();

    expect(mockToastShow).toHaveBeenCalledWith('Failed to open Ledger');
    expect(onSelectDevice).not.toHaveBeenCalled();

    await pressDevice();
    await waitFor(() => {
      expect(onSelectDevice).toHaveBeenCalledWith(mockDevice);
    });
  });

  it('continues signing when connected even if Ethereum still needs opening', async () => {
    const onSelectDevice = jest.fn();
    mockApiLedger.checkEthApp.mockImplementationOnce(async callback => {
      callback(false);
      return false;
    });

    render(<ConnectLedger onSelectDevice={onSelectDevice} />);
    await pressDevice();

    await waitFor(() => {
      expect(onSelectDevice).toHaveBeenCalledWith(mockDevice);
    });
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

  it('shows the existing guidance when the Ethereum app is missing', async () => {
    mockApiLedger.checkEthApp.mockImplementation(async callback => {
      callback(false);
      return false;
    });
    mockApiLedger.importFirstAddress.mockRejectedValueOnce(
      new Error('OpenAppCommandError 0x6807'),
    );
    mockLedgerErrorHandler.mockReturnValueOnce('NO_ETH_APP');

    render(<ConnectLedger />);
    await pressDevice();

    await waitFor(() => {
      expect(mockToastShow).toHaveBeenCalledWith(
        'page.newAddress.ledger.error.lockedOrNoEthApp',
      );
    });
  });
});
