import { EmitterSubscription } from 'react-native';
import { makeRnEEClass, resolveNativeModule } from './utils';
import DeviceUtils from '../utils/device';

const { RNScreenshotPrevent: nativeModule } = resolveNativeModule(
  'RNScreenshotPrevent',
);

type Listeners = {
  userDidTakeScreenshot: () => any;
  preventScreenshotChanged: (ret: {
    isPrevent: boolean;
    success: boolean;
  }) => any;
};
const { NativeEventEmitter } = makeRnEEClass<Listeners>();
const eventEmitter = new NativeEventEmitter(nativeModule);

/**
 * subscribes to userDidTakeScreenshot event
 */
function iosOnUserDidTakeScreenshot(fn: Listeners['userDidTakeScreenshot']): {
  readonly remove: EmitterSubscription['remove'];
} {
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

  return eventEmitter.addListener('userDidTakeScreenshot', fn);
}

function onPreventScreenshotChanged(fn: Listeners['preventScreenshotChanged']) {
  return eventEmitter.addListener('preventScreenshotChanged', fn);
}

if (__DEV__) {
  iosOnUserDidTakeScreenshot(() => {
    console.debug('userDidTakeScreenshot');
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
  iosOnUserDidTakeScreenshot,
  enableSecureView(imagePath: string = '') {
    if (DeviceUtils.isIOS()) {
      console.warn(
        'RNScreenshotPrevent.enableSecureView not work correctly on iOS',
      );
      return;
    }
    return nativeModule.enableSecureView(imagePath);
  },
  disableSecureView() {
    if (DeviceUtils.isIOS()) {
      console.warn(
        'RNScreenshotPrevent.disableSecureView not work correctly on iOS',
      );
      return;
    }
    return nativeModule.disableSecureView();
  },
});

export default RNScreenshotPrevent;
