import { resolveNativeModule, wrapPlatformOnlyMethod } from './utils';
import NativeRNHelpers from './specs/NativeRNHelpers';

const { RNHelpers: nativeModule } = resolveNativeModule(
  'RNHelpers',
  NativeRNHelpers,
);

const buildInfo =
  nativeModule.buildInfo || nativeModule.getConstants?.().buildInfo;

const RNHelpers = Object.freeze({
  forceExitApp: nativeModule.forceExitApp,
  iosSetScrollEdgeEffectsHidden: wrapPlatformOnlyMethod({
    // Appearance-only capability: older native bundles can safely omit it.
    method: nativeModule.iosSetScrollEdgeEffectsHidden ?? (() => undefined),
    platform: 'ios',
    fallbackFn: () => undefined,
  }),
  measureViewRelativeTo: nativeModule.measureViewRelativeTo,
  buildInfo,
  setSensitiveClipboard: nativeModule.setSensitiveClipboard,
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
  iosExcludeFileFromBackup: wrapPlatformOnlyMethod({
    method: nativeModule.iosExcludeFileFromBackup,
    platform: 'ios',
    fallbackFn: () => Promise.resolve(true),
  }),
  // iosExcludeDirectoryFromBackup: wrapPlatformOnlyMethod({ method: nativeModule.iosExcludeDirectoryFromBackup, platform: 'ios', fallbackFn: () => Promise.resolve(true) }),
});

export default RNHelpers;
