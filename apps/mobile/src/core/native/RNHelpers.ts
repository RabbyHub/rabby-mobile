import { resolveNativeModule, wrapPlatformOnlyMethod } from './utils';
import { NativeModuleNames } from './specs/types';

const { RNHelpers: nativeModule } = resolveNativeModule(
  NativeModuleNames.RNHelpers,
);

const RNHelpers = Object.freeze({
  forceExitApp: nativeModule.forceExitApp,
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
