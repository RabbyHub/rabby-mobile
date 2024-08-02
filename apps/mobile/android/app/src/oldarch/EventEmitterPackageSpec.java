package com.debank.rabbymobile;

import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

abstract class EventEmitterPackageSpec extends ReactContextBaseJavaModule {
  EventEmitterPackageSpec(ReactApplicationContext context) {
    super(context);
  }
  // private static final List<EventDispatcherListener> mListeners = new CopyOnWriteArrayList<>();

  private int listenerCount = 0;
  /**
   * @notice addListener/removeListeners is required for RN built in Event Emitter Calls.
   * You may subscribe it in javascript like:
   *
   * ```js
   *  const eventEmitter = new NativeEventEmitter(nativeModule);
   *  eventEmitter.addListener(...)
   * ```
   *
   * call `new NativeEventEmitter` requires explicit exported method `addListener` and `removeListeners`
   * implementation on Package for current RN version, it was not required for previous RN versions.
   *
   * But you don't need real implementation for these methods, you can just keep them empty.
   */
  /**
   * @see https://stackoverflow.com/a/69649068
   * @why Keep: Required for RN built in Event Emitter Calls.
   */
  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {}

    listenerCount += 1;
  }

  /**
   * @see https://stackoverflow.com/a/69649068
   * @why Keep: Required for RN built in Event Emitter Calls.
   */
  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }
}
