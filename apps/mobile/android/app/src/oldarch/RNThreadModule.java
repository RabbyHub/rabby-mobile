package com.debank.rabbymobile;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.JSBundleLoader;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.devsupport.interfaces.DevSupportManager;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okio.Okio;
import okio.Sink;

import com.reactlibrary.ReactContextBuilder;
import com.reactlibrary.JSThread;
import com.reactlibrary.ThreadBaseReactPackage;

import javax.annotation.Nullable;

public class RNThreadModule extends EventEmitterPackageSpec implements LifecycleEventListener {
  public static final String NAME = "RNThread";
  private HashMap<Integer, JSThread> threads;

  private ReactApplicationContext reactContext;

  private ReactNativeHost reactNativeHost;

  private ReactPackage additionalThreadPackages[];

  public RNThreadModule(final ReactApplicationContext reactContext, ReactPackage additionalThreadPackages[]) {
    super(reactContext);
    this.reactContext = reactContext;
    threads = new HashMap<>();

    ReactApplication rnApp = (ReactApplication) reactContext.getApplicationContext();
    this.reactNativeHost = rnApp.getReactNativeHost();

    this.additionalThreadPackages = additionalThreadPackages;
    reactContext.addLifecycleEventListener(this);
  }

  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void startThread(
    final String jsFileName,
    final @Nullable ReadableMap opts,
    final Promise promise
  ) {
    Log.d(NAME, "Starting web thread - " + jsFileName);

    ReadableMap options = opts == null ? Arguments.createMap() : opts;
    OptionValue opt_usePackedResource = RabbyUtils.parseOptionDict(options, "usePackedResource");

    // When we create the absolute file path later, a "./" will break it.
    // Remove the leading "./" if it exists.
    String jsFileSlug = jsFileName.contains("./") ? jsFileName.replace("./", "") : jsFileName;

    boolean usePackedResource = opt_usePackedResource.jstype == OptionValue.JSType.BOOLEAN ? opt_usePackedResource.boolVal.booleanValue() : false;

    DevSupportManager dsm = getDevSupportManager();
    Boolean devSupportedEnabled = getDevSupportManager().getDevSupportEnabled();
    JSBundleLoader bundleLoader = getDevSupportManager().getDevSupportEnabled()
            ? usePackedResource ? createDevPackedBundleLoader(jsFileName, jsFileSlug) : createDevBundleLoader(jsFileName, jsFileSlug)
            : createReleaseBundleLoader(jsFileName, jsFileSlug);

    try {
      ReactApplicationContext hostContext = getReactApplicationContext();
      ArrayList<ReactPackage> threadPackages = new ArrayList<ReactPackage>(Arrays.asList(additionalThreadPackages));
      threadPackages.add(0, new ThreadBaseReactPackage(getReactInstanceManager()));

      ReactContextBuilder threadContextBuilder = new ReactContextBuilder((Context) hostContext)
              .setJSBundleLoader(bundleLoader)
              .setDevSupportManager(dsm)
              .setReactInstanceManager(getReactInstanceManager())
              .setReactPackages(threadPackages);

      JSThread thread = new JSThread(hostContext, jsFileSlug);
      thread.runFromContext(hostContext, threadContextBuilder);
      threads.put(thread.getThreadId(), thread);
      promise.resolve(thread.getThreadId());

      WritableMap params = Arguments.createMap();
      params.putInt("tid", thread.getThreadId());
      RabbyUtils.rnCtxSendEvent(hostContext, "@ThreadStarted", params);
    } catch (Exception e) {
      promise.reject(e);
      getDevSupportManager().handleException(e);
    }
  }

  @ReactMethod
  public void stopThread(final int threadId) {
    final JSThread thread = threads.get(threadId);
    if (thread == null) {
      Log.d(NAME, "Cannot stop thread - thread is null for id " + threadId);
      return;
    }

    new Handler(Looper.getMainLooper()).post(new Runnable() {
      @Override
      public void run() {
        thread.terminate();
        threads.remove(threadId);
      }
    });
  }

  @ReactMethod
  public void postThreadMessage(int threadId, String message) {
    JSThread thread = threads.get(threadId);
    if (thread == null) {
      Log.d(NAME, "Cannot post message to thread - thread is null for id " + threadId);
      return;
    }

    thread.postMessage(message);
  }

  @Override
  public void onHostResume() {
    new Handler(Looper.getMainLooper()).post(new Runnable() {
      @Override
      public void run() {
        for (int threadId : threads.keySet()) {
          threads.get(threadId).onHostResume();
        }
      }
    });
  }

  @Override
  public void onHostPause() {
    new Handler(Looper.getMainLooper()).post(new Runnable() {
      @Override
      public void run() {
        for (int threadId : threads.keySet()) {
          threads.get(threadId).onHostPause();
        }
      }
    });
  }

  @Override
  public void onHostDestroy() {
    Log.d(NAME, "onHostDestroy - Clean JS Threads");

    new Handler(Looper.getMainLooper()).post(new Runnable() {
      @Override
      public void run() {
        for (int threadId : threads.keySet()) {
          threads.get(threadId).terminate();
        }
      }
    });
  }

  @Override
  public void onCatalystInstanceDestroy() {
    super.onCatalystInstanceDestroy();
    onHostDestroy();
  }

    /*
     *  Helper methods
     */

  private JSBundleLoader createDevBundleLoader(String jsFileName, String jsFileSlug) {
    String bundleUrl = bundleUrlForFile(jsFileName);
    // nested file directory will not exist in the files dir during development,
    // so remove any leading directory paths to simply download a flat file into
    // the root of the files directory.
    String[] splitFileSlug = jsFileSlug.split("/");
    String bundleOut = getReactApplicationContext().getFilesDir().getAbsolutePath() + "/" + splitFileSlug[splitFileSlug.length - 1];

    Log.d(NAME, "createDevBundleLoader - download web thread to - " + bundleOut);
    downloadScriptToFileSync(bundleUrl, bundleOut);

    return JSBundleLoader.createCachedBundleFromNetworkLoader(bundleUrl, bundleOut);
  }

  private JSBundleLoader createDevPackedBundleLoader(String jsFileName, String jsFileSlug) {
    String[] splitFileSlug = jsFileSlug.split("/");
    String basename = splitFileSlug[splitFileSlug.length - 1];
    Boolean devSupportEnabled = getDevSupportManager().getDevSupportEnabled();

    if (!devSupportEnabled) return createReleaseBundleLoader(jsFileName, jsFileSlug);

//    String fileUrl = "/data/data/" + reactContext.getPackageName() + "/files/" + basename;
    String fileUrl = reactContext.getFilesDir().getAbsolutePath() + "/" + basename;
    return JSBundleLoader.createFileLoader(fileUrl);
  }

  private JSBundleLoader createReleaseBundleLoader(String jsFileName, String jsFileSlug) {
    String[] splitFileSlug = jsFileSlug.split("/");
    String basename = splitFileSlug[splitFileSlug.length - 1];

    String assetUrl = "assets://threads/" + basename + ".bundle";
    Log.d(NAME, "createReleaseBundleLoader - reading file from assets " + assetUrl);

    return JSBundleLoader.createAssetLoader(reactContext, assetUrl, false);
  }

  private ReactInstanceManager getReactInstanceManager() {
    return reactNativeHost.getReactInstanceManager();
  }

  private DevSupportManager getDevSupportManager() {
    return getReactInstanceManager().getDevSupportManager();
  }

  private String bundleUrlForFile(final String fileName) {
    // http://localhost:8081/index.android.bundle?platform=android&dev=true&hot=false&minify=false
    String sourceUrl = getDevSupportManager().getSourceUrl().replace("http://", "");
    return  "http://"
            + sourceUrl.split("/")[0]
            + "/"
            + fileName
            + ".bundle?platform=android&dev=true&hot=false&minify=false";
  }

  private void downloadScriptToFileSync(String bundleUrl, String bundleOut) {
    OkHttpClient client = new OkHttpClient();
    final File out = new File(bundleOut);

    Request request = new Request.Builder()
            .url(bundleUrl)
            .build();

    try {
      Response response = client.newCall(request).execute();
      if (!response.isSuccessful()) {
        throw new RuntimeException("Error downloading thread script - " + response.toString());
      }

      Sink output = Okio.sink(out);
      Okio.buffer(response.body().source()).readAll(output);
    } catch (IOException e) {
      throw new RuntimeException("Exception downloading thread script to file", e);
    }
  }
}
