import { NativeModules, Platform } from 'react-native';

const isTurboModuleEnabled = global.__turboModuleProxy != null;

interface NativeModulesStatic {
  ReactNativeSecurity: {
    blockScreen(): void;
    unblockScreen(): void;
  };
}

export const IS_ANDROID = Platform.OS === 'android';
export const IS_IOS = Platform.OS === 'ios';

export function resolveNativeModule<T extends keyof NativeModulesStatic>(
  name: T,
) {
  const NATIVE_ERROR =
    `The native module '${name}' doesn't seem to be added. Make sure: \n\n` +
    '- You rebuilt the app after native code changed\n' +
    '- You are not using Expo managed workflow\n';

  const nModule = NativeModules[name];

  const module: NativeModulesStatic[T] = nModule
    ? nModule
    : new Proxy(
        {},
        {
          get() {
            throw new Error(NATIVE_ERROR);
          },
        },
      );

  return {
    [name]: module,
  } as {
    [P in T]: NativeModulesStatic[T];
  };
}
