import {
  makeRnEEClass,
  resolveNativeModule,
  wrapPlatformOnlyMethod,
} from './utils';

export const NATIVE_ASSET_SYNC_COMPLETED_EVENT =
  '@RabbyNativeAssetSyncCompleted' as const;

type RNHelpersListeners = {
  [NATIVE_ASSET_SYNC_COMPLETED_EVENT]: (receipt: unknown) => void;
};

const { RNHelpers: nativeModule } = resolveNativeModule('RNHelpers');
const { NativeEventEmitter } = makeRnEEClass<RNHelpersListeners>();
let nativeEventEmitter: InstanceType<typeof NativeEventEmitter> | undefined;

export const addNativeAssetSyncCompletionListener = (
  listener: RNHelpersListeners[typeof NATIVE_ASSET_SYNC_COMPLETED_EVENT],
) => {
  nativeEventEmitter ||= new NativeEventEmitter(nativeModule);
  return nativeEventEmitter.addListener(
    NATIVE_ASSET_SYNC_COMPLETED_EVENT,
    listener,
  );
};

const RNHelpers = Object.freeze({
  ...nativeModule,
  moveTaskToBack: wrapPlatformOnlyMethod({
    method: nativeModule.moveTaskToBack,
    platform: 'android',
    fallbackFn: () => Promise.resolve(false),
  }),
  shareFile: wrapPlatformOnlyMethod({
    method: nativeModule.shareFile,
    platform: 'android',
    fallbackFn: () =>
      Promise.reject(
        new Error('RNHelpers.shareFile is only available on Android'),
      ),
  }),
  runNativeOpenApiDiagnostic:
    nativeModule.runNativeOpenApiDiagnostic ||
    (() =>
      Promise.reject(
        new Error('RNHelpers.runNativeOpenApiDiagnostic is unavailable'),
      )),
  runNativeTokenCacheSyncDiagnostic:
    nativeModule.runNativeTokenCacheSyncDiagnostic ||
    (() =>
      Promise.reject(
        new Error('RNHelpers.runNativeTokenCacheSyncDiagnostic is unavailable'),
      )),
  startNativeTokenChains:
    nativeModule.startNativeTokenChains ||
    (() =>
      Promise.reject(
        new Error('RNHelpers.startNativeTokenChains is unavailable'),
      )),
  runNativeProtocolCacheSyncDiagnostic:
    nativeModule.runNativeProtocolCacheSyncDiagnostic ||
    (() =>
      Promise.reject(
        new Error(
          'RNHelpers.runNativeProtocolCacheSyncDiagnostic is unavailable',
        ),
      )),
  startNativeProtocolSync:
    nativeModule.startNativeProtocolSync ||
    (() =>
      Promise.reject(
        new Error('RNHelpers.startNativeProtocolSync is unavailable'),
      )),
  runNativeNftCacheSyncDiagnostic:
    nativeModule.runNativeNftCacheSyncDiagnostic ||
    (() =>
      Promise.reject(
        new Error('RNHelpers.runNativeNftCacheSyncDiagnostic is unavailable'),
      )),
  startNativeNftSync:
    nativeModule.startNativeNftSync ||
    (() =>
      Promise.reject(new Error('RNHelpers.startNativeNftSync is unavailable'))),
  runNativeTokenCacheWriteDiagnostic:
    nativeModule.runNativeTokenCacheWriteDiagnostic ||
    (() =>
      Promise.reject(
        new Error(
          'RNHelpers.runNativeTokenCacheWriteDiagnostic is unavailable',
        ),
      )),
  cancelNativeTokenCacheSync:
    nativeModule.cancelNativeTokenCacheSync || (() => undefined),
  cancelAllNativeTokenCacheSyncs:
    nativeModule.cancelAllNativeTokenCacheSyncs || (() => undefined),
  cancelNativeProtocolCacheSync:
    nativeModule.cancelNativeProtocolCacheSync || (() => undefined),
  cancelAllNativeProtocolCacheSyncs:
    nativeModule.cancelAllNativeProtocolCacheSyncs || (() => undefined),
  cancelNativeNftCacheSync:
    nativeModule.cancelNativeNftCacheSync || (() => undefined),
  cancelAllNativeNftCacheSyncs:
    nativeModule.cancelAllNativeNftCacheSyncs || (() => undefined),
  iosExcludeFileFromBackup: wrapPlatformOnlyMethod({
    method: nativeModule.iosExcludeFileFromBackup,
    platform: 'ios',
    fallbackFn: () => Promise.resolve(true),
  }),
  // iosExcludeDirectoryFromBackup: wrapPlatformOnlyMethod({ method: nativeModule.iosExcludeDirectoryFromBackup, platform: 'ios', fallbackFn: () => Promise.resolve(true) }),
});

export default RNHelpers;
