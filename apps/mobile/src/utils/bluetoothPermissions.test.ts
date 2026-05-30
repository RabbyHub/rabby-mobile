const mockAlert = jest.fn();
const mockOpenURL = jest.fn();
const mockSendIntent = jest.fn();
const mockOpenSettings = jest.fn();
const mockCheckMultiple = jest.fn();
const mockRequest = jest.fn();
const mockRequestMultiple = jest.fn();

jest.mock('react-native', () => ({
  Alert: {
    alert: (...args: unknown[]) => mockAlert(...args),
  },
  Linking: {
    openURL: (...args: unknown[]) => mockOpenURL(...args),
    sendIntent: (...args: unknown[]) => mockSendIntent(...args),
    openSettings: (...args: unknown[]) => mockOpenSettings(...args),
  },
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('react-native-permissions', () => ({
  checkMultiple: (...args: unknown[]) => mockCheckMultiple(...args),
  request: (...args: unknown[]) => mockRequest(...args),
  requestMultiple: (...args: unknown[]) => mockRequestMultiple(...args),
  PERMISSIONS: {
    ANDROID: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    },
  },
  RESULTS: {
    BLOCKED: 'blocked',
    DENIED: 'denied',
    GRANTED: 'granted',
    UNAVAILABLE: 'unavailable',
  },
}));

jest.mock('./i18n', () => ({
  t: (key: string) => key,
}));

import { Platform } from 'react-native';
import { PERMISSIONS, RESULTS } from 'react-native-permissions';
import {
  UpdateFirmwareAlert,
  checkAndRequestAndroidBluetooth,
  showBluetoothPermissionsAlert,
  showBluetoothPoweredOffAlert,
} from './bluetoothPermissions';

const androidPermissions = [
  PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
  PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
  PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
];

describe('bluetoothPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens platform-specific Bluetooth settings from the powered-off alert', async () => {
    await showBluetoothPoweredOffAlert();
    mockAlert.mock.calls[0][2][0].onPress();

    expect(mockOpenURL).toHaveBeenCalledWith('App-Prefs:Bluetooth');

    jest.clearAllMocks();
    (Platform as any).OS = 'android';

    await showBluetoothPoweredOffAlert();
    mockAlert.mock.calls[0][2][0].onPress();

    expect(mockSendIntent).toHaveBeenCalledWith(
      'android.settings.BLUETOOTH_SETTINGS',
    );
  });

  it('opens app settings and firmware docs from alerts', async () => {
    await showBluetoothPermissionsAlert();
    mockAlert.mock.calls[0][2][0].onPress();

    expect(mockOpenSettings).toHaveBeenCalled();

    jest.clearAllMocks();

    await UpdateFirmwareAlert();
    mockAlert.mock.calls[0][2][0].onPress();

    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://support.ledger.com/hc/articles/360003117594-Ledger-device-firmware-update-FAQ',
    );
  });

  it('returns true when all Android Bluetooth permissions are already granted', async () => {
    mockCheckMultiple.mockResolvedValue(
      Object.fromEntries(
        androidPermissions.map(permission => [permission, RESULTS.GRANTED]),
      ),
    );

    await expect(checkAndRequestAndroidBluetooth()).resolves.toBe(true);

    expect(mockCheckMultiple).toHaveBeenCalledWith(androidPermissions);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockRequestMultiple).not.toHaveBeenCalled();
  });

  it('requests a single missing Android Bluetooth permission', async () => {
    mockCheckMultiple.mockResolvedValue({
      [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED,
      [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.DENIED,
      [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]: RESULTS.GRANTED,
    });
    mockRequest.mockResolvedValue(RESULTS.GRANTED);

    await expect(checkAndRequestAndroidBluetooth()).resolves.toBe(true);

    expect(mockRequest).toHaveBeenCalledWith(
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
    );
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('shows the permissions alert when a single requested permission is denied', async () => {
    mockCheckMultiple.mockResolvedValue({
      [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED,
      [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.DENIED,
      [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]: RESULTS.GRANTED,
    });
    mockRequest.mockResolvedValue(RESULTS.DENIED);

    await expect(checkAndRequestAndroidBluetooth()).resolves.toBe(false);

    expect(mockAlert).toHaveBeenCalledWith(
      'bluetooth.permissions_alert.title',
      'bluetooth.permissions_alert.message',
      expect.any(Array),
    );
  });

  it('requests multiple missing permissions and reports denied results', async () => {
    mockCheckMultiple.mockResolvedValue({
      [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.DENIED,
      [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.BLOCKED,
      [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]: RESULTS.GRANTED,
    });
    mockRequestMultiple.mockResolvedValue({
      [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED,
      [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.BLOCKED,
    });

    await expect(checkAndRequestAndroidBluetooth()).resolves.toBe(false);

    expect(mockRequestMultiple).toHaveBeenCalledWith([
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
    ]);
    expect(mockAlert).toHaveBeenCalledWith(
      'bluetooth.permissions_alert.title',
      'bluetooth.permissions_alert.message',
      expect.any(Array),
    );
  });

  it('returns true when a grouped permission request grants everything', async () => {
    mockCheckMultiple.mockResolvedValue({
      [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.DENIED,
      [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.DENIED,
      [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]: RESULTS.GRANTED,
    });
    mockRequestMultiple.mockResolvedValue({
      [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED,
      [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.GRANTED,
    });

    await expect(checkAndRequestAndroidBluetooth()).resolves.toBe(true);
  });
});
