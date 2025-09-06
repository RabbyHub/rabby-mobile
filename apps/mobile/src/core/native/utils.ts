import {
  EmitterSubscription,
  NativeEventEmitter,
  NativeModule,
  NativeModules,
  Platform,
  UIManager,
} from 'react-native';
import { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';
import { enableLayoutAnimations } from 'react-native-reanimated';
import { TurboNativeModules } from './specs';
import { NativeModuleNames } from './specs/types';

const isTurboModuleEnabled = global.__turboModuleProxy != null;

type NativeModulesStatic = {
  [NativeModuleNames.ReactNativeSecurity]: /* NativeModule &  */ import('./specs/NativeReactNativeSecurity').Methods;
  [NativeModuleNames.RNScreenshotPrevent]: NativeModule &
    import('./specs/NativeRNScreenshotPrevent').Methods;
  [NativeModuleNames.RNTimeChanged]: NativeModule &
    import('./specs/NativeRNTimeChanged').Methods;
  [NativeModuleNames.RNHelpers]: NativeModule &
    import('./specs/NativeRNHelpers').Methods;
};

export const IS_ANDROID = Platform.OS === 'android';
export const IS_IOS = Platform.OS === 'ios';

if (IS_ANDROID) {
  enableLayoutAnimations(false);
  // TODO: only use it if new arch not enabled
  // UIManager.setLayoutAnimationEnabledExperimental &&
  //   UIManager.setLayoutAnimationEnabledExperimental(false);
}

export function resolveNativeModule<T extends NativeModuleNames>(name: T) {
  const NATIVE_ERROR =
    `The native module '${name}' doesn't seem to be added. Make sure: \n\n` +
    '- You rebuilt the app after native code changed\n' +
    '- You are not using Expo managed workflow\n';

  const nModule = isTurboModuleEnabled
    ? TurboNativeModules[name]
    : NativeModules[name];

  const module: NativeModulesStatic[T] = nModule
    ? nModule
    : (new Proxy(
        {},
        {
          get() {
            throw new Error(NATIVE_ERROR);
          },
        },
      ) as any);

  return {
    [name]: module,
  } as {
    [P in T]: NativeModulesStatic[T];
  };
}

type EventEmitterDef = Record<string, EventEmitter<any>>;
export type EventEmitterRecordToListeners<T extends EventEmitterDef> = {
  [K in keyof T]: Parameters<T[K]>[0];
};
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

export function wrapPlatformOnlyMethod<
  T extends ((...args: any[]) => void) | ((...args: any[]) => Promise<void>),
>({
  method,
  fallbackFn,
  platform,
}: {
  method?: T;
  fallbackFn: T;
  platform: typeof Platform.OS | (typeof Platform.OS)[];
}): T {
  const platforms = Array.isArray(platform) ? platform : [platform];

  if (!platforms.includes(Platform.OS)) {
    return function (...args: Parameters<T>) {
      const err = new Error(
        `Method is not available on ${Platform.OS}, will use fallback`,
      );

      console.error(err);
      fallbackFn(...args);
    } as T;
  }

  if (typeof method !== 'function') {
    throw new Error(
      `Method is not implemented on platform ${Platform.OS}, but it should be`,
    );
  }

  return method;
}
