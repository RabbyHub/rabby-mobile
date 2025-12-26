package com.reactlibrary;

import com.debank.rabbymobile.BuildConfig;
import com.debank.rabbymobile.RabbyUtils;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

@ReactModule(name = ThreadSelfModule.REACT_MODULE_NAME)
public class ThreadSelfModule extends ReactContextBaseJavaModule {
    public static final String REACT_MODULE_NAME = "ThreadSelfModule";

    private int threadId;
    private ReactApplicationContext context;
    private ReactApplicationContext parentContext;

    public ThreadSelfModule(ReactApplicationContext context) {
        super(context);
        this.context = context;
    }

    public void initialize(int threadId, ReactApplicationContext parentContext) {
        this.parentContext = parentContext;
        this.threadId = threadId;
    }

    @Override
    public String getName() {
        return REACT_MODULE_NAME;
    }

    @ReactMethod
    public void postMessage(String data) {
        if (parentContext == null) { return; }

      WritableMap params = Arguments.createMap();
      params.putInt("tid", threadId);
      params.putString("message", data);

      if (BuildConfig.DEBUG) {
        RabbyUtils.rnCtxSendEvent(parentContext, "DevThreadMessage", params.copy());
      }

      RabbyUtils.rnCtxSendEvent(parentContext, "msgFromThread", params);
    }
}
