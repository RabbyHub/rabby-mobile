import {
  EmitterSubscription,
  NativeEventEmitter,
  NativeModule,
  NativeModules,
  Platform,
} from 'react-native';

const isTurboModuleEnabled = global.__turboModuleProxy != null;

interface NativeModulesStatic {
  ReactNativeSecurity: /* NativeModule &  */ {
    blockScreen(): void;
    unblockScreen(): void;
  };
  RNScreenshotPrevent: NativeModule & {
    togglePreventScreenshot: (isPrevent: boolean) => void;
    iosIsBeingCaptured(): boolean;
    // iosToggleBlurView(isProtected: boolean): void;
    iosProtectFromScreenRecording(): void;
    iosUnprotectFromScreenRecording(): void;
  };
  RNTimeChanged: NativeModule & {
    exitAppForSecurity(): void;
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

type Listener = (resp?: any) => void;

export function makeRnEEClass<Listeners extends Record<string, Listener>>() {
  type EE = typeof NativeEventEmitter & {
    addListener<T extends keyof Listeners & string>(
      eventType: T,
      listener: Listeners[T],
      context?: Object,
    ): EmitterSubscription;
  };

  return { NativeEventEmitter: NativeEventEmitter as EE };
}
