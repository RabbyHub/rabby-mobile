import { resolveNativeModule, wrapPlatformOnlyMethod } from './utils';

const { RNHelpers: nativeModule } = resolveNativeModule('RNHelpers');

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
  syncNativeTokenChains:
    nativeModule.syncNativeTokenChains ||
    (() =>
      Promise.reject(
        new Error('RNHelpers.syncNativeTokenChains is unavailable'),
      )),
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
  iosExcludeFileFromBackup: wrapPlatformOnlyMethod({
    method: nativeModule.iosExcludeFileFromBackup,
    platform: 'ios',
    fallbackFn: () => Promise.resolve(true),
  }),
  // iosExcludeDirectoryFromBackup: wrapPlatformOnlyMethod({ method: nativeModule.iosExcludeDirectoryFromBackup, platform: 'ios', fallbackFn: () => Promise.resolve(true) }),
});

export default RNHelpers;
