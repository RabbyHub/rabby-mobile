import { makeRnEEClass, resolveNativeModule } from './utils';

const { RNScreenshotPrevent: nativeModule } = resolveNativeModule(
  'RNScreenshotPrevent',
);

type Listeners = {
  userDidTakeScreenshot: () => any;
  screenCapturedChanged: (ret: { isBeingCaptured: boolean }) => any;
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
function iosOnUserDidTakeScreenshot(fn: Listeners['userDidTakeScreenshot']) {
  const handler = makeDefaultHandler<'userDidTakeScreenshot'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('userDidTakeScreenshot', fn);
}

function iosOnScreenCaptureChanged(fn: Listeners['screenCapturedChanged']) {
  const handler = makeDefaultHandler<'screenCapturedChanged'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('screenCapturedChanged', fn);
}

function onPreventScreenshotChanged(fn: Listeners['preventScreenshotChanged']) {
  const handler = makeDefaultHandler<'preventScreenshotChanged'>(fn);
  if (handler) return handler;

  return eventEmitter.addListener('preventScreenshotChanged', fn);
}

if (__DEV__) {
  iosOnUserDidTakeScreenshot(() => {
    console.debug('userDidTakeScreenshot');
  });
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
  iosOnUserDidTakeScreenshot,
});

export default RNScreenshotPrevent;
