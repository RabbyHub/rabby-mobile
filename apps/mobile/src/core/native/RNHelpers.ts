import { IS_IOS, resolveNativeModule, wrapPlatformOnlyMethod } from './utils';
import NativeRNHelpers, { type Spec } from './specs/NativeRNHelpers';

const { RNHelpers: nativeModule } = resolveNativeModule(
  'RNHelpers',
  NativeRNHelpers,
);

const buildInfo =
  nativeModule.buildInfo || nativeModule.getConstants?.().buildInfo;

const RNHelpers = Object.freeze({
  forceExitApp: nativeModule.forceExitApp,
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
  async iosPullRefreshProbe(
    command: string,
    runId: string,
    durationMs: number,
  ): Promise<string> {
    const unsupported =
      '{"schemaVersion":1,"supported":false,"status":"unsupported","samples":[]}';
    if (!IS_IOS) {
      return unsupported;
    }

    // The diagnostic may run against a native binary without the temporary RN
    // probe. Do not make normal screen/module loading depend on its presence.
    try {
      const probeModule = nativeModule as Partial<
        Pick<Spec, 'iosPullRefreshProbe'>
      >;
      if (typeof probeModule.iosPullRefreshProbe !== 'function') {
        return unsupported;
      }
      return await probeModule.iosPullRefreshProbe(command, runId, durationMs);
    } catch {
      return unsupported;
    }
  },
  // iosExcludeDirectoryFromBackup: wrapPlatformOnlyMethod({ method: nativeModule.iosExcludeDirectoryFromBackup, platform: 'ios', fallbackFn: () => Promise.resolve(true) }),
});

export default RNHelpers;
