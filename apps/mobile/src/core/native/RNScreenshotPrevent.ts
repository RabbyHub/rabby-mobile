import { PermissionsAndroid } from 'react-native';
import {
  IS_ANDROID,
  IS_IOS,
  makeRnEEClass,
  resolveNativeModule,
} from './utils';
import i18next from 'i18next';

const { RNScreenshotPrevent: nativeModule } = resolveNativeModule(
  'RNScreenshotPrevent',
);

type Listeners = {
  /**
   * @platform iOS, Android >= 14
   */
  userDidTakeScreenshot: (ret?: {
    captured?: boolean;
    path?: string;
    height?: string | number;
    width?: string | number;
    imageBase64?: string;
    imageType?: 'jpeg' | 'png';
    name?: string;
  }) => any;
  screenCapturedChanged: (ret: { isBeingCaptured: boolean }) => any;
  screenCaptureDetectionChanged: (ret: { enabled: boolean }) => any;
  /**
   * @description subscribe to android app state change, pause means app is in background, resume means app is in foreground
   */
  androidOnLifeCycleChanged: (ret: { state: 'resume' | 'pause' }) => any;
  /** @description pointless now */
  preventScreenshotChanged: (ret: {
    isPrevent: boolean;
    success: boolean;
  }) => any;
};
const { NativeEventEmitter } = makeRnEEClass<Listeners>();
const eventEmitter = new NativeEventEmitter(nativeModule);

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
// type DefaulHandle = {
//   readonly remove: EmitterSubscription['remove'];
// };
/**
 * subscribes to userDidTakeScreenshot event
 */
function onUserDidTakeScreenshot(fn: Listeners['userDidTakeScreenshot']) {
  const handler = makeDefaultHandler<'userDidTakeScreenshot'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('userDidTakeScreenshot', fn);
}

function iosOnScreenCaptureChanged(fn: Listeners['screenCapturedChanged']) {
  const handler = makeDefaultHandler<'screenCapturedChanged'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('screenCapturedChanged', fn);
}

function androidOnLifeCycleChanged(fn: Listeners['androidOnLifeCycleChanged']) {
  const handler = makeDefaultHandler<'androidOnLifeCycleChanged'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('androidOnLifeCycleChanged', fn);
}

function onPreventScreenshotChanged(fn: Listeners['preventScreenshotChanged']) {
  const handler = makeDefaultHandler<'preventScreenshotChanged'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('preventScreenshotChanged', fn);
}

function onScreenCaptureDetectionChanged(
  fn: Listeners['screenCaptureDetectionChanged'],
) {
  const handler = makeDefaultHandler<'screenCaptureDetectionChanged'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('screenCaptureDetectionChanged', fn);
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
    if (IS_IOS) return;

    return nativeModule.scanScreenshotDirectory(...params);
  },
});

export default RNScreenshotPrevent;
