import {
  PermissionsAndroid,
  Permission,
  Rationale,
  Platform,
  Linking,
} from 'react-native';

import i18next from 'i18next';
import { stringUtils } from '@rabby-wallet/base-utils';
import DeviceUtils from './device';

export class PerAndroid {
  static requiredPermissions = [
    DeviceUtils.isGteAndroid(14) &&
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    DeviceUtils.isGteAndroid(14) &&
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
    DeviceUtils.isGteAndroid(14) &&
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED,
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    // PermissionsAndroid.PERMISSIONS.BLUETOOTH,
    // PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    DeviceUtils.isAndroid() &&
      !DeviceUtils.isGteAndroid(14) &&
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
  ].filter(Boolean) as Permission[];

  static getRationaleForPermission(permission: Permission): Rationale | null {
    switch (permission) {
      case PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES:
        return {
          title: i18next.t('global.permissionRequest.mediaLibrary.title'),
          message: i18next.t('global.permissionRequest.mediaLibrary.message'),
          buttonNeutral: i18next.t(
            'global.permissionRequest.common.askMeLater',
          ),
          buttonNegative: i18next.t('global.cancel'),
          buttonPositive: i18next.t('global.ok'),
        };
      case PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO:
        return {
          title: i18next.t('global.permissionRequest.mediaLibrary.title'),
          message: i18next.t('global.permissionRequest.mediaLibrary.message'),
          buttonNeutral: i18next.t(
            'global.permissionRequest.common.askMeLater',
          ),
          buttonNegative: i18next.t('global.cancel'),
          buttonPositive: i18next.t('global.ok'),
        };
      case PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED:
        return {
          title: i18next.t('global.permissionRequest.mediaLibrary.title'),
          message: i18next.t('global.permissionRequest.mediaLibrary.message'),
          buttonNeutral: i18next.t(
            'global.permissionRequest.common.askMeLater',
          ),
          buttonNegative: i18next.t('global.cancel'),
          buttonPositive: i18next.t('global.ok'),
        };
      case PermissionsAndroid.PERMISSIONS.CAMERA:
        return {
          title: i18next.t('global.permissionRequest.camera.title'),
          message: i18next.t('global.permissionRequest.camera.message'),
          buttonNeutral: i18next.t(
            'global.permissionRequest.common.askMeLater',
          ),
          buttonNegative: i18next.t('global.cancel'),
          buttonPositive: i18next.t('global.ok'),
        };
      case PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN:
        return {
          title: i18next.t('global.permissionRequest.bluetoothScan.title'),
          message: i18next.t('global.permissionRequest.bluetoothScan.message'),
          buttonNeutral: i18next.t(
            'global.permissionRequest.common.askMeLater',
          ),
          buttonNegative: i18next.t('global.cancel'),
          buttonPositive: i18next.t('global.ok'),
        };
      case PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT:
        // case PermissionsAndroid.PERMISSIONS.BLUETOOTH:
        return {
          title: i18next.t('global.permissionRequest.bluetoothConnect.title'),
          message: i18next.t(
            'global.permissionRequest.bluetoothConnect.message',
          ),
          buttonNeutral: i18next.t(
            'global.permissionRequest.common.askMeLater',
          ),
          buttonNegative: i18next.t('global.cancel'),
          buttonPositive: i18next.t('global.ok'),
        };
      // case PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN:
      //   return {
      //     title: i18next.t('global.permissionRequest.bluetoothAdmin.title'),
      //     message: i18next.t('global.permissionRequest.bluetoothAdmin.message'),
      //     buttonNeutral: i18next.t(
      //       'global.permissionRequest.common.askMeLater',
      //     ),
      //     buttonNegative: i18next.t('global.cancel'),
      //     buttonPositive: i18next.t('global.ok'),
      //   };
      case PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION:
        return {
          title: i18next.t('global.permissionRequest.location.title'),
          message: i18next.t('global.permissionRequest.location.message'),
          buttonNeutral: i18next.t(
            'global.permissionRequest.common.askMeLater',
          ),
          buttonNegative: i18next.t('global.cancel'),
          buttonPositive: i18next.t('global.ok'),
        };
      case PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE:
        return {
          title: i18next.t('global.permissionRequest.mediaLibrary.title'),
          message: i18next.t('global.permissionRequest.mediaLibrary.message'),
          buttonNeutral: i18next.t(
            'global.permissionRequest.common.askMeLater',
          ),
          buttonNegative: i18next.t('global.cancel'),
          buttonPositive: i18next.t('global.ok'),
        };
      default:
        return null;
    }
  }

  static async applyAndroidPermission(
    target: Permission,
    options?: { checkFirst?: boolean },
  ) {
    if (Platform.OS !== 'android') {
      throw new Error(`applyAndroidPermission is only supported on Android`);
    }

    const rationale = PerAndroid.getRationaleForPermission(target);
    if (!rationale) {
      throw new Error(`No rationale found for permission ${target}`);
    }

    return PermissionsAndroid.request(target, rationale);
  }

  static async goToSystemSettingsFor(target?: Permission) {
    if (Platform.OS !== 'android') {
      throw new Error(`goToSystemSettingsFor is only supported on Android`);
    }

    // const packageName = APPLICATION_ID;
    // const settingsUrl = `package:${packageName}`;
    Linking.openSettings();
  }

  static formatAndroidPermission(permission: Permission) {
    return {
      keyLabel: stringUtils.unPrefix(permission, 'android.permission.'),
      fullLabel: stringUtils.ensurePrefix(permission, 'android.permission.'),
    };
  }
}
