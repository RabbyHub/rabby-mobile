package com.debank.rabbymobile;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Collections;
import java.util.List;

public final class WorkerAssetStorePackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(
      ReactApplicationContext reactContext) {
    return Collections.<NativeModule>singletonList(
        new WorkerAssetStoreModule(reactContext));
  }

  @Override
  public List<ViewManager> createViewManagers(
      ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
