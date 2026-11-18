import NativeSecurity from '@/core/native/specs/NativeReactNativeSecurity';
import { appMMKV } from '../mmkvInstances';
import { createSecurePreferenceStorage } from './storage';

export const securePreferences = createSecurePreferenceStorage(
  {
    read: key => appMMKV.getString(key) ?? (appMMKV.contains(key) ? '' : null),
    write: (key, value) => appMMKV.set(key, value),
    remove: key => appMMKV.delete(key),
  },
  {
    async open(create) {
      if (!NativeSecurity) {
        throw new Error('Secure preference key store unavailable');
      }
      const status = await NativeSecurity.openSecurePreferencesKey(create);
      if (status !== 'ready' && status !== 'missing' && status !== 'created') {
        throw new Error('Unknown secure preference key status');
      }
      return status;
    },
    mac: message => NativeSecurity?.computeSecurePreferenceHmac(message) ?? '',
  },
);
