import {
  EmitterSubscription,
  NativeEventEmitter,
  NativeModule,
  NativeModules,
  Platform,
  UIManager,
} from 'react-native';
import { enableLayoutAnimations } from 'react-native-reanimated';

const isTurboModuleEnabled = global.__turboModuleProxy != null;

interface NativeModulesStatic {
  ReactNativeSecurity: /* NativeModule &  */ {
    blockScreen(): void;
    unblockScreen(): void;
  };
  RNScreenshotPrevent: NativeModule & {
    scanScreenshotDirectory: () => void;
    startScreenCaptureDetection: () => Promise<void>;
    stopScreenCaptureDetection: () => Promise<void>;
    togglePreventScreenshot: (isPrevent: boolean) => void;
    iosIsBeingCaptured(): boolean;
    // iosToggleBlurView(isProtected: boolean): void;
    iosProtectFromScreenRecording(): Promise<void>;
    iosUnprotectFromScreenRecording(): Promise<void>;
  };
  RNTimeChanged: NativeModule & {
    exitAppForSecurity(): void;
  };
  RNHelpers: NativeModule & {
    forceExitApp(): void;
    /**
     * @description try to set a file to not be backed up by iCloud
     * @param filePath
     */
    iosExcludeFileFromBackup?(filePath: string): Promise<boolean>;
    // /**
    //  * @description try to set a directory's files(including files in subdirectories) to not be backed up by iCloud
    //  */
    // iosExcludeDirectoryFromBackup?(directoryPath: string): Promise<boolean>;
  };
  RNThread: NativeModule & {
    startThread(
      jsFilePath: string,
      options?: {
        usePackedResource?: true | string;
      },
    ): Promise<number>;
    stopThread(threadId: number): void;
    postThreadMessage(threadId: number, message: string): void;
  };
}

export const IS_ANDROID = Platform.OS === 'android';
export const IS_IOS = Platform.OS === 'ios';

if (IS_ANDROID) {
  enableLayoutAnimations(false);
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(false);
}

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
