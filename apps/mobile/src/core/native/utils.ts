import {
  EmitterSubscription,
  NativeEventEmitter,
  NativeModule,
  NativeModules,
  Platform,
  UIManager,
} from 'react-native';
import type {
  NativeAccessibleVisualMediaList,
  NativeAccessibleVisualMediaQueryOptions,
  NativeFileCapabilityRequestOptions,
  NativeFileCapabilitySnapshot,
} from './fileCapability';

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
    setAppSwitcherBlurEnabled: (isEnabled: boolean) => void;
    iosIsBeingCaptured(): boolean;
    // iosToggleBlurView(isProtected: boolean): void;
    iosProtectFromScreenRecording(): Promise<void>;
    iosUnprotectFromScreenRecording(): Promise<void>;
  };
  RNTimeChanged: NativeModule & {
    exitAppForSecurity(): void;
  };
  RNHelpers: NativeModule & {
    buildInfo?: {
      BUILD_GIT_HASH?: string;
      BUILD_GIT_HASH_TIME?: string;
      BUILD_TIME?: string;
      BUILD_GIT_COMMITOR?: string;
      METRO_CACHE_ENABLED?: boolean;
    };
    forceExitApp(): void;
    androidTraceInstant?(name: string): void;
    androidTraceBeginSection?(name: string): void;
    androidTraceEndSection?(): void;
    androidTraceBeginAsyncSection?(name: string, cookie: number): void;
    androidTraceEndAsyncSection?(name: string, cookie: number): void;
    androidTraceCounter?(name: string, value: number): void;
    moveTaskToBack?(): Promise<boolean>;
    shareFile?(options: {
      filePath: string;
      mimeType?: string;
      title?: string;
      subject?: string;
    }): Promise<void>;
    runNativeOpenApiDiagnostic?(address: string): Promise<{
      success: boolean;
      error: string;
      firstStatusCode: number;
      secondStatusCode: number;
      firstDurationMs: number;
      secondDurationMs: number;
      firstBodyBytes: number;
      secondBodyBytes: number;
      firstCredentialDisposition: string;
      secondCredentialDisposition: string;
      firstRequestCredentialRevision: number;
      firstCurrentCredentialRevision: number;
      secondRequestCredentialRevision: number;
      secondCurrentCredentialRevision: number;
      secondUsedLatestAvailableCredential: boolean;
    }>;
    runNativeTokenCacheSyncDiagnostic?(
      address: string,
      replaceExisting: boolean,
    ): Promise<{
      success: boolean;
      address: string;
      generation: number;
      stage: string;
      chainCount: number;
      sourceTokenCount: number;
      filteredTokenCount: number;
      committedRowCount: number;
      durationMs: number;
      error: string;
    }>;
    syncNativeTokenChains?(
      address: string,
      chainIds: string[],
      replacementScope: 'address' | 'chains',
      replaceExisting: boolean,
    ): Promise<{
      success: boolean;
      address: string;
      generation: number;
      stage: string;
      chainCount: number;
      sourceTokenCount: number;
      filteredTokenCount: number;
      committedRowCount: number;
      durationMs: number;
      error: string;
    }>;
    runNativeTokenCacheWriteDiagnostic?(): Promise<{
      success: boolean;
      stage: string;
      attemptedRowCount: number;
      durationMs: number;
      error: string;
    }>;
    cancelNativeTokenCacheSync?(address: string): void;
    cancelAllNativeTokenCacheSyncs?(): void;
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
  RNFileHelpers: NativeModule & {
    getFileCapabilitySnapshot?(): Promise<NativeFileCapabilitySnapshot>;
    requestVisualMediaAccess?(
      options?: NativeFileCapabilityRequestOptions,
    ): Promise<NativeFileCapabilitySnapshot>;
    listAccessibleVisualMedia?(
      options?: NativeAccessibleVisualMediaQueryOptions,
    ): Promise<NativeAccessibleVisualMediaList>;
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
  try {
    (
      require('react-native-reanimated') as {
        enableLayoutAnimations?: (enabled: boolean) => void;
      }
    ).enableLayoutAnimations?.(false);
  } catch {
    // react-native-reanimated is best-effort here; tests and non-native
    // runtimes may not be able to evaluate it.
  }
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
