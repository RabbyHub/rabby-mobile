import { Platform } from 'react-native';
import { resolveNativeModule, IS_ANDROID } from './utils';
import { NativeModuleNames } from './specs/types';

const { ReactNativeSecurity } = resolveNativeModule(
  NativeModuleNames.ReactNativeSecurity,
);

export function nativeBlockScreen() {
  if (IS_ANDROID) {
    return ReactNativeSecurity.blockScreen();
  } else if (__DEV__) {
    console.warn(
      `nativeBlockScreen is not available on this platform: ${Platform.OS}`,
    );
  }
}

export function nativeUnblockScreen() {
  if (IS_ANDROID) {
    return ReactNativeSecurity.unblockScreen();
  } else if (__DEV__) {
    console.warn(
      `nativeBlockScreen is not available on this platform: ${Platform.OS}`,
    );
  }
}
