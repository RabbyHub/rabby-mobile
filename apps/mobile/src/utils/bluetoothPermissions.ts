// Forked from: https://github.com/rainbow-me/rainbow/blob/5ae2fba13376609907fa823e27e5d3ee8dfa4664/src/utils/bluetoothPermissions.ts

import { Alert, Linking, Platform } from 'react-native';
import {
  checkMultiple as checkForMultiplePermissions,
  PERMISSIONS,
  RESULTS,
  request as requestPermission,
  AndroidPermission,
  requestMultiple as requestMultiplePermissions,
} from 'react-native-permissions';
import i18n from './i18n';

/**
 * Shows an alert if device's bluetooth is powered off
 */
export const showBluetoothPoweredOffAlert = async () => {
  Alert.alert(
    i18n.t('bluetooth.powered_off_alert.title'),
    i18n.t('bluetooth.powered_off_alert.message'),
    [
      {
        onPress: () => {
          Platform.OS === 'ios'
            ? Linking.openURL('App-Prefs:Bluetooth')
            : Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
        },
        text: i18n.t('bluetooth.powered_off_alert.open_settings'),
      },
      {
        onPress: () => null,
        style: 'cancel',
        text: i18n.t('bluetooth.powered_off_alert.cancel'),
      },
    ],
  );
};

/**
 * Shows an alert w/ deeplink to settings to enable bluetooth permissions for iOS
 */
export const showBluetoothPermissionsAlert = async () => {
  Alert.alert(
    i18n.t('bluetooth.permissions_alert.title'),
    i18n.t('bluetooth.permissions_alert.message'),
    [
      {
        onPress: () => {
          Linking.openSettings();
        },
        text: i18n.t('bluetooth.permissions_alert.open_settings'),
      },
      {
        onPress: () => null,
        style: 'cancel',
        text: i18n.t('bluetooth.permissions_alert.cancel'),
      },
    ],
  );
};

export const UpdateFirmwareAlert = async () => {
  Alert.alert(
    i18n.t('bluetooth.update_firmware_alert.title'),
    i18n.t('bluetooth.update_firmware_alert.message'),
    [
      {
        onPress: () => {
          Linking.openURL(
            'https://support.ledger.com/hc/articles/360003117594-Ledger-device-firmware-update-FAQ',
          );
        },
        text: i18n.t('bluetooth.update_firmware_alert.update'),
      },
      {
        onPress: () => null,
        style: 'cancel',
        text: i18n.t('bluetooth.update_firmware_alert.cancel'),
      },
    ],
  );
};

/**
 * Checks and requests bluetooth permissions for Android
 */
export const checkAndRequestAndroidBluetooth = async (): Promise<boolean> => {
  const ANDROID_BT_PERMISSION = [
    PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
    PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
    PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  ];

  const res = await checkForMultiplePermissions(ANDROID_BT_PERMISSION);
  console.debug('[Bluetooth] Android Permission status: ', { res });

  const deniedPermissions: AndroidPermission[] = [];

  // check if we are missing any permissions
  for (const [key, value] of Object.entries(res)) {
    if (value === RESULTS.DENIED || value === RESULTS.BLOCKED) {
      deniedPermissions.push(key as AndroidPermission);
    }
  }

  if (deniedPermissions.length === 0) {
    console.debug('[Bluetooth] Android Permissions all granted');
    return true;
  }
  // if we're only missing one, only request one
  else if (deniedPermissions.length === 1) {
    const askResult = await requestPermission(deniedPermissions[0]);
    console.debug('[Bluetooth] Android Permission single askResult: ', {
      askResult,
    });
    if (askResult === RESULTS.GRANTED) {
      return true;
      // user denied request
    } else if (askResult === RESULTS.DENIED) {
      await showBluetoothPermissionsAlert();

      // should try to deeplink the user at this point or show a fun error :)
      return false;
      // devices without bluetooth & simulators
    } else if (askResult === RESULTS.UNAVAILABLE) {
      return false;
    }

    // else request in a group
  } else if (deniedPermissions.length > 1) {
    const askResults = await requestMultiplePermissions(deniedPermissions);
    console.debug(
      '[Bluetooth] Android Bluetooth Permission multiple askResult: ',
      { askResults },
    );

    const deniedOrBlockedPermissions: AndroidPermission[] = [];
    // check if we are missing any permissions
    for (const [key, value] of Object.entries(askResults)) {
      if (value === RESULTS.DENIED || value === RESULTS.BLOCKED) {
        deniedOrBlockedPermissions.push(key as AndroidPermission);
      }
    }
    // all permissions granted
    if (deniedOrBlockedPermissions.length === 0) {
      return true;
    } else {
      // user denied request
      // could recurse here but I think it's better to show the user an alert
      await showBluetoothPermissionsAlert();
    }
  }
  return false;
};

/**
 * Android runtime permissions needed to scan for and connect to BLE hardware
 * wallets: BLUETOOTH_SCAN + BLUETOOTH_CONNECT on Android 12+ (API 31+, the
 * manifest declares SCAN with neverForLocation), ACCESS_FINE_LOCATION before.
 *
 * Unlike checkAndRequestAndroidBluetooth this does not ask for location on
 * Android 12+ and does not show the Ledger-specific alert; the caller shows
 * its own message when this returns false.
 */
export const requestAndroidBleScanPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  const permissions: AndroidPermission[] =
    Number(Platform.Version) >= 31
      ? [
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
        ]
      : [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];

  const isOk = (value?: string) =>
    value === RESULTS.GRANTED ||
    value === RESULTS.LIMITED ||
    // Not applicable on this OS version / device; let the SDK decide.
    value === RESULTS.UNAVAILABLE;

  const current = await checkForMultiplePermissions(permissions);
  const missing = permissions.filter(p => !isOk(current[p]));
  if (missing.length === 0) {
    return true;
  }
  if (missing.some(p => current[p] === RESULTS.BLOCKED)) {
    return false;
  }
  const requested = await requestMultiplePermissions(missing);
  return missing.every(p => isOk(requested[p]));
};
