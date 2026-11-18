import NativeSecurity from '@/core/native/specs/NativeReactNativeSecurity';
import { MMKV_ROOT_PATH } from '@/core/utils/appFS';
import { MMKV_FILE_NAMES } from '../mmkvConstants';
import { appMMKV } from '../mmkvInstances';
import { createSecurePreferenceStorage } from './storage';

export const securePreferences = createSecurePreferenceStorage(
  {
    read: key => appMMKV.getString(key) ?? (appMMKV.contains(key) ? '' : null),
    write: (key, value) => appMMKV.set(key, value),
    remove: key => appMMKV.delete(key),
  },
  {
    async open(stage) {
      if (!NativeSecurity) {
        throw new Error('Secure preference key store unavailable');
      }
      const status = await NativeSecurity.openSecurePreferencesKey(stage);
      if (status !== 'ready' && status !== 'missing' && status !== 'staged') {
        throw new Error('Unknown secure preference key status');
      }
      return status;
    },
    async commit() {
      if (!NativeSecurity) {
        throw new Error('Secure preference key store unavailable');
      }
      await NativeSecurity.commitSecurePreferencesKey(
        `${MMKV_ROOT_PATH}/${MMKV_FILE_NAMES.DEFAULT}`,
      );
    },
    mac: message => NativeSecurity?.computeSecurePreferenceHmac(message) ?? '',
  },
);
