package com.debank.rabbymobile;

import androidx.annotation.Nullable;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.TurboReactPackage;

import java.util.HashMap;
import java.util.Map;

public class RNThreadPackage extends TurboReactPackage {
    private ReactPackage additionalThreadPackages[];

    public RNThreadPackage(ReactPackage... additionalThreadPackages) {
        super();
        this.additionalThreadPackages = additionalThreadPackages;
    }

    @Nullable
    @Override
    public NativeModule getModule(String name, ReactApplicationContext reactContext) {
      if (name.equals(RNThreadModule.NAME)) {
        return new RNThreadModule(reactContext, additionalThreadPackages);
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
                RNThreadModule.NAME,
                new ReactModuleInfo(
                        RNThreadModule.NAME,
                        RNThreadModule.NAME,
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
