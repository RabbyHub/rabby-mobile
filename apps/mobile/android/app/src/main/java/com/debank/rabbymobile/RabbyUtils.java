package com.debank.rabbymobile;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class RabbyUtils {
  static public void rnCtxSendEvent(ReactContext reactContext, String eventName, @Nullable WritableMap params) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventName, params);
  }

  public static OptionValue parseOptionDict(@Nullable ReadableMap options, String key) {
    if (options == null || !options.hasKey(key)) {
        return OptionValue.nil();
    }

    ReadableType type = options.getType(key);
    switch (type) {
        case Boolean:
            return OptionValue.ofBoolean(options.getBoolean(key));
        case String:
            return OptionValue.ofString(options.getString(key));
        case Number:
            return OptionValue.ofNumber(options.getDouble(key));
        case Null:
        default:
            return OptionValue.nil();
    }
  }
}
