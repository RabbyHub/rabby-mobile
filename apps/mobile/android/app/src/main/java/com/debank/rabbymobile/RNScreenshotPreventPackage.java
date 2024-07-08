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

public class RNScreenshotPreventPackage extends TurboReactPackage /* implements ReactPackage */ {
  // @Override
  // public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
  //   return Collections.emptyList();
  // }

  // useless for TurboReactPackage
  // @Override
  // public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
  //   List<NativeModule> modules = new ArrayList<>();
  //   modules.add(new RNScreenshotPreventModule(reactContext));

  //   return modules;
  // }

  @Nullable
  @Override
  public NativeModule getModule(String name, ReactApplicationContext reactContext) {
    if (name.equals(RNScreenshotPreventModule.NAME)) {
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
              RNScreenshotPreventModule.NAME,
              new ReactModuleInfo(
                      RNScreenshotPreventModule.NAME,
                      RNScreenshotPreventModule.NAME,
                      false, // canOverrideExistingModule
                      false, // needsEagerInit
                      true, // hasConstants
                      false, // isCxxModule
                      isTurboModule // isTurboModule
      ));
      return moduleInfos;
    };
  }
}
