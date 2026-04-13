import {
  makeRnEEClass,
  resolveNativeModule,
  wrapPlatformOnlyMethod,
} from './utils';

const { RNHelpers: nativeModule } = resolveNativeModule('RNHelpers');

type Listeners = {};
const { NativeEventEmitter } = makeRnEEClass<Listeners>();
const eventEmitter = new NativeEventEmitter(nativeModule);

function makeDefaultHandler<T extends keyof Listeners>(fn: Listeners[T]) {
  if (typeof fn !== 'function') {
    console.error('RNHelpers: addListener requires valid callback function');

    return {
      remove: (): void => {
        console.error(
          'RNHelpers: remove not work because addListener requires valid callback function',
        );
      },
    };
  }
}

const RNHelpers = Object.freeze({
  ...nativeModule,
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
