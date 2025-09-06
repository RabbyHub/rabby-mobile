import { NativeModuleNames } from './specs/types';
import {
  EventEmitterRecordToListeners,
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
  // iosOnUserDidTakeScreenshot(() => {
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
  togglePreventScreenshot: nativeModule.togglePreventScreenshot,
  iosIsBeingCaptured: nativeModule.iosIsBeingCaptured,
  iosProtectFromScreenRecording: nativeModule.iosProtectFromScreenRecording,
  iosUnprotectFromScreenRecording: nativeModule.iosUnprotectFromScreenRecording,
  onPreventScreenshotChanged,
  // iosToggleBlurView(bool: boolean) {
  //   nativeModule.iosToggleBlurView(!!bool);
  // },
  iosOnScreenCaptureChanged,
  iosOnUserDidTakeScreenshot,
  androidOnLifeCycleChanged,
  onScreenCaptureDetectionChanged,
});

export default RNScreenshotPrevent;
