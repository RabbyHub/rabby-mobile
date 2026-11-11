// Error handling helpers for the OneKey BLE flow.
//
// Codes and default messages mirror `HardwareErrorCode` /
// `HardwareErrorCodeMessage` from @onekeyfe/hd-shared 1.2.7. They are inlined
// because the mobile app only depends on @onekeyfe/hd-ble-sdk directly.

export const ONEKEY_ERROR_CODE = {
  DeviceNotFound: 105,
  DeviceInterruptedFromOutside: 107,
  DeviceInterruptedFromUser: 109,
  DeviceNotOpenedPassphrase: 113,
  DeviceBusy: 117,
  CallMethodNeedUpgradeFirmware: 407,
  NewFirmwareForceUpdate: 414,
  BleScanError: 700,
  BlePermissionError: 701,
  BleLocationError: 702,
  BleDeviceNotBonded: 705,
  BleLocationServicesDisabled: 712,
  BleTimeoutError: 713,
  BleDeviceBondError: 715,
  BleDeviceBondedCanceled: 718,
  BlePeerRemovedPairingInformation: 719,
  BleDeviceDisconnected: 720,
  BlePoweredOff: 721,
  BleUnsupported: 722,
  BleBondInvalid: 724,
  PinInvalid: 801,
  PinCancelled: 802,
  ActionCancelled: 803,
  CallQueueActionCancelled: 822,
} as const;

const C = ONEKEY_ERROR_CODE;

// Default SDK messages, used when only the message survived (for example a
// keyring error wrapped as `new Error(String(e))`). "Device interrupted" is
// left out on purpose: 107 (outside) and 109 (user) share that text.
const SDK_MESSAGE_LIST: Array<[number, string]> = [
  [C.DeviceNotFound, 'Device not found'],
  [C.DeviceNotOpenedPassphrase, 'Device not opened passphrase'],
  [C.DeviceBusy, 'Device is busy'],
  [C.CallMethodNeedUpgradeFirmware, 'Call method need upgrade firmware'],
  [C.NewFirmwareForceUpdate, 'new firmware has been released, please update'],
  [C.BleScanError, 'BLE scan error'],
  [C.BlePermissionError, 'Bluetooth required to be turned on'],
  [
    C.BleLocationError,
    'Location permissions for the application are not available',
  ],
  [C.BleDeviceNotBonded, 'device is not bonded'],
  [C.BleLocationServicesDisabled, 'Location Services disabled'],
  [C.BleTimeoutError, 'The connection has timed out unexpectedly'],
  [C.BleDeviceBondError, 'Bluetooth pairing failed'],
  [C.BleDeviceBondedCanceled, 'device is canceled bonding'],
  [C.BlePeerRemovedPairingInformation, 'need to delete pairing information'],
  [C.BleDeviceDisconnected, 'Device disconnected'],
  [C.BlePoweredOff, 'Bluetooth is turned off'],
  [C.BleUnsupported, 'Bluetooth is not supported on this device'],
  [C.BleBondInvalid, 'Bluetooth pairing information is no longer valid'],
  [C.PinInvalid, 'Pin invalid'],
  [C.PinCancelled, 'Pin cancelled'],
  [C.CallQueueActionCancelled, 'Action cancelled by user on call queue'],
  [C.ActionCancelled, 'Action cancelled by user'],
];

// Longest first, so a specific message wins over a shorter prefix of it.
const SDK_MESSAGES = [...SDK_MESSAGE_LIST].sort(
  ([, a], [, b]) => b.length - a.length,
);

function readCode(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return undefined;
}

/**
 * Best-effort SDK error code for an SDK response, an Error, or a message.
 */
export function getOneKeyErrorCode(error: unknown): number | undefined {
  if (error === null || error === undefined) {
    return undefined;
  }
  const direct = readCode(error);
  if (direct !== undefined) {
    return direct;
  }
  if (typeof error === 'object') {
    const e = error as {
      code?: unknown;
      payload?: { code?: unknown; error?: unknown };
      message?: unknown;
    };
    const code = readCode(e.code) ?? readCode(e.payload?.code);
    if (code !== undefined) {
      return code;
    }
    const message =
      typeof e.payload?.error === 'string'
        ? e.payload.error
        : typeof e.message === 'string'
        ? e.message
        : undefined;
    return message ? getOneKeyErrorCode(message) : undefined;
  }
  if (typeof error === 'string') {
    const lower = error.toLowerCase();
    const hit = SDK_MESSAGES.find(([, msg]) =>
      lower.includes(msg.toLowerCase()),
    );
    return hit?.[0];
  }
  return undefined;
}

/** Scan failures that will not clear up by scanning again right away. */
export function isOneKeyBleSetupError(code?: number) {
  return (
    code === C.BlePermissionError ||
    code === C.BleLocationError ||
    code === C.BleLocationServicesDisabled ||
    code === C.BlePoweredOff ||
    code === C.BleUnsupported
  );
}

/** The user (or the app on their behalf) cancelled on the device or in UI. */
export function isOneKeyUserCancelError(code?: number) {
  return (
    code === C.PinCancelled ||
    code === C.ActionCancelled ||
    code === C.CallQueueActionCancelled ||
    code === C.DeviceInterruptedFromUser
  );
}

/** iOS uses 701 for both a powered-off radio and missing Bluetooth access. */
export function isOneKeyPermissionError(
  code: number | undefined,
  isIOS: boolean,
  bluetoothPermission?: string,
) {
  return (
    code === C.BleLocationError ||
    (isIOS &&
      code === C.BlePermissionError &&
      (bluetoothPermission === 'denied' || bluetoothPermission === 'blocked'))
  );
}

type TFunc = (key: string, options?: any) => string;

const ERROR_I18N_KEY: Record<number, string> = {
  [C.DeviceNotFound]: 'deviceNotFound',
  [C.DeviceNotOpenedPassphrase]: 'passphraseDisabled',
  [C.DeviceInterruptedFromOutside]: 'disconnected',
  [C.BleDeviceDisconnected]: 'disconnected',
  [C.BleTimeoutError]: 'disconnected',
  [C.DeviceBusy]: 'deviceBusy',
  [C.CallMethodNeedUpgradeFirmware]: 'firmwareTooOld',
  [C.NewFirmwareForceUpdate]: 'firmwareTooOld',
  [C.BlePermissionError]: 'bluetoothOff',
  [C.BlePoweredOff]: 'bluetoothOff',
  [C.BleLocationError]: 'bluetoothPermission',
  [C.BleLocationServicesDisabled]: 'locationServicesDisabled',
  [C.BleUnsupported]: 'bluetoothUnsupported',
  [C.BleScanError]: 'scanFailed',
  [C.BleDeviceNotBonded]: 'pairingFailed',
  [C.BleDeviceBondError]: 'pairingFailed',
  [C.BleDeviceBondedCanceled]: 'pairingFailed',
  [C.BlePeerRemovedPairingInformation]: 'pairingInvalid',
  [C.BleBondInvalid]: 'pairingInvalid',
  [C.PinInvalid]: 'pinInvalid',
  [C.PinCancelled]: 'cancelled',
  [C.ActionCancelled]: 'cancelled',
  [C.CallQueueActionCancelled]: 'cancelled',
  [C.DeviceInterruptedFromUser]: 'cancelled',
};

/**
 * A user-facing message for a OneKey failure, or undefined when the error is
 * not a known SDK error (callers keep their own fallback text then).
 */
export function getOneKeyErrorMessage(
  error: unknown,
  t: TFunc,
): string | undefined {
  const code = getOneKeyErrorCode(error);
  const key = code !== undefined ? ERROR_I18N_KEY[code] : undefined;
  return key ? t(`page.newAddress.onekey.error.${key}`) : undefined;
}
