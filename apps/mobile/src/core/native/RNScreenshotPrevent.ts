import { NativeModules } from 'react-native';

import { NativeModuleNames } from './specs/types';
import {
  EventEmitterRecordToListeners,
  IS_IOS,
  makeRnEEClass,
  resolveNativeModule,
} from './utils';

const { RNScreenshotPrevent: nativeModule } = resolveNativeModule(
  NativeModuleNames.RNScreenshotPrevent,
);

type Listeners = EventEmitterRecordToListeners<
  import('./specs/NativeRNScreenshotPrevent').EventEmitterRecord
>;
const { NativeEventEmitter } = makeRnEEClass<Listeners>();
const legacyEventModule =
  (NativeModules[NativeModuleNames.RNScreenshotPrevent] as
    | typeof nativeModule
    | undefined) || nativeModule;
const eventEmitter = new NativeEventEmitter(legacyEventModule);

function makeDefaultHandler<T extends keyof Listeners>(fn: Listeners[T]) {
  if (typeof fn !== 'function') {
    console.error(
      'RNScreenshotPrevent: addListener requires valid callback function',
    );

    return {
      remove: (): void => {
        console.error(
          'RNScreenshotPrevent: remove not work because addListener requires valid callback function',
        );
      },
    };
  }
}

function addNativeListener<T extends keyof Listeners & string>(
  eventName: T,
  fn: Listeners[T],
) {
  const handler = makeDefaultHandler<T>(fn);
  if (handler) {
    return handler;
  }

  const codegenEventEmitter = (
    nativeModule as unknown as Record<string, unknown>
  )[eventName];
  if (typeof codegenEventEmitter === 'function') {
    return (
      codegenEventEmitter as (listener: Listeners[T]) => {
        remove: () => void;
      }
    )(fn);
  }

  // Legacy bridge fallback for Android and non-newArch iOS builds.
  return eventEmitter.addListener(eventName, fn);
}

// type DefaulHandle = {
//   readonly remove: EmitterSubscription['remove'];
// };
/**
 * subscribes to userDidTakeScreenshot event
 */
function onUserDidTakeScreenshot(fn: Listeners['userDidTakeScreenshot']) {
  return addNativeListener('userDidTakeScreenshot', fn);
}

function iosOnScreenCaptureChanged(fn: Listeners['screenCapturedChanged']) {
  return addNativeListener('screenCapturedChanged', fn);
}

function iosOnAppSwitcherBlurChanged(fn: Listeners['appSwitcherBlurChanged']) {
  return addNativeListener('appSwitcherBlurChanged', fn);
}

function androidOnLifeCycleChanged(fn: Listeners['androidOnLifeCycleChanged']) {
  return addNativeListener('androidOnLifeCycleChanged', fn);
}

function onPreventScreenshotChanged(fn: Listeners['preventScreenshotChanged']) {
  return addNativeListener('preventScreenshotChanged', fn);
}

function onScreenCaptureDetectionChanged(
  fn: Listeners['screenCaptureDetectionChanged'],
) {
  return addNativeListener('screenCaptureDetectionChanged', fn);
}

if (__DEV__) {
  // onUserDidTakeScreenshot(() => {
  //   console.debug('userDidTakeScreenshot');
  // });
  iosOnScreenCaptureChanged(params => {
    console.debug('screenCapturedChanged', params);
  });
  onPreventScreenshotChanged(params => {
    console.debug('preventScreenshotChanged', params);
  });
  // nativeModule.iosProtectFromScreenRecording();
}

/**
 *
 * @see https://github.com/killserver/react-native-screenshot-prevent/issues/23
 * @see https://github.com/killserver/react-native-screenshot-prevent/issues/17
 */
const RNScreenshotPrevent = Object.freeze({
  ...nativeModule,
  onPreventScreenshotChanged,
  // iosToggleBlurView(bool: boolean) {
  //   nativeModule.iosToggleBlurView(!!bool);
  // },
  iosOnAppSwitcherBlurChanged,
  iosOnScreenCaptureChanged,
  onUserDidTakeScreenshot,
  androidOnLifeCycleChanged,
  onScreenCaptureDetectionChanged,
  // Android screenshot listening methods
  // Android 14+ screen capture detection methods
  startScreenCaptureDetection: async () => {
    // if (
    //   IS_ANDROID &&
    //   !(await PermissionsAndroid.check(
    //     PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    //   ))
    // ) {
    //   await PermissionsAndroid.request(
    //     PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    //     {
    //       title: i18next.t('global.permissionRequest.mediaLibrary.title'),
    //       message: i18next.t('global.permissionRequest.mediaLibrary.message'),
    //       buttonNeutral: i18next.t('global.permissionRequest.common.askMeLater'),
    //       buttonNegative: i18next.t('global.cancel'),
    //       buttonPositive: i18next.t('global.ok'),
    //     },
    //   );
    // }
    return nativeModule.startScreenCaptureDetection();
  },
  scanScreenshotDirectory: (
    ...params: Parameters<typeof nativeModule.scanScreenshotDirectory>
  ) => {
    if (IS_IOS) {
      return;
    }

    return nativeModule.scanScreenshotDirectory(...params);
  },
});

export default RNScreenshotPrevent;
