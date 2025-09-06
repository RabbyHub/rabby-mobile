package com.debank.rabbymobile;

import androidx.annotation.Nullable;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.TurboReactPackage;

import java.util.HashMap;
import java.util.Map;
// import java.util.Collections;
// import java.util.Arrays;
// import java.util.ArrayList;
import java.util.List;

import com.debank.rabbymobile.RNScreenshotPreventModule;

public class RNScreenshotPreventPackage extends TurboReactPackage /* implements ReactPackage */ {
  @Nullable
  @Override
  public NativeModule getModule(String name, ReactApplicationContext reactContext) {
    if (name.equals(RNScreenshotPreventImpl.NAME)) {
      return new RNScreenshotPreventModule(reactContext);
    } else {
      return null;
    }
  }

  @Override
  public ReactModuleInfoProvider getReactModuleInfoProvider() {
    return () -> {
      final Map<String, ReactModuleInfo> moduleInfos = new HashMap<>();
      boolean isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
      moduleInfos.put(
              RNScreenshotPreventImpl.NAME,
              new ReactModuleInfo(
                      RNScreenshotPreventImpl.NAME,
                      RNScreenshotPreventImpl.NAME,
                      false, // canOverrideExistingModule
                      false, // needsEagerInit
                      false, // hasConstants
                      false, // isCxxModule
                      isTurboModule // isTurboModule
      ));
      return moduleInfos;
    };
  }
}
