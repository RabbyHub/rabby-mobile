package com.debank.rabbymobile.thread;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;

import android.content.Context;

import androidx.annotation.Nullable;
import androidx.test.core.app.ApplicationProvider;

import com.debank.rabbymobile.MainApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.BridgeReactContext;
import com.facebook.react.bridge.JavaScriptModule;
import com.facebook.react.bridge.JSBundleLoader;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.devsupport.interfaces.DevSupportManager;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.reactlibrary.JSThread;
import com.reactlibrary.ReactContextBuilder;
import com.reactlibrary.ThreadBaseReactPackage;

import org.junit.Test;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class ReactContextBuilderInstrumentationTest {
  @Test
  public void buildsHermesThreadContextAndRoundTripsHostMessage() throws Exception {
    MainApplication application = ApplicationProvider.getApplicationContext();
    RecordingReactContext hostContext = new RecordingReactContext(application);
    JSThread thread = new JSThread(hostContext, "instrumentation-thread-smoke.js");

    thread.runFromContext(hostContext, createBuilder(application, writeSmokeBundle(application)));
    thread.postMessage("hello-from-host");

    RecordedEvent event = hostContext.awaitEvent("msgFromThread");
    assertEquals(thread.getThreadId(), event.params.getInt("tid"));
    assertEquals("hermes:ack:hello-from-host", event.params.getString("message"));

    thread.terminate();

    RecordedEvent stopped = hostContext.awaitEvent("@ThreadStopped");
    assertEquals(thread.getThreadId(), stopped.params.getInt("tid"));
  }

  @Test
  public void ignoresPostAndTerminateBeforeThreadContextExists() {
    MainApplication application = ApplicationProvider.getApplicationContext();
    RecordingReactContext hostContext = new RecordingReactContext(application);
    JSThread thread = new JSThread(hostContext, "not-started.js");

    thread.postMessage("ignored");
    thread.terminate();

    assertFalse(hostContext.hasEvent("msgFromThread"));
    assertFalse(hostContext.hasEvent("@ThreadStopped"));
  }

  private ReactContextBuilder createBuilder(Context context, File bundleFile) {
    ReactInstanceManager instanceManager =
        ((MainApplication) context).getReactNativeHost().getReactInstanceManager();
    DevSupportManager devSupportManager = instanceManager.getDevSupportManager();
    ArrayList<ReactPackage> reactPackages = new ArrayList<>();
    reactPackages.add(new ThreadBaseReactPackage(instanceManager));

    return new ReactContextBuilder(context)
        .setJSBundleLoader(JSBundleLoader.createFileLoader(bundleFile.getAbsolutePath()))
        .setDevSupportManager(devSupportManager)
        .setReactInstanceManager(instanceManager)
        .setReactPackages(reactPackages);
  }

  private File writeSmokeBundle(Context context) throws Exception {
    File bundleFile = new File(context.getCacheDir(), "instrumentation-thread-smoke.js");
    String source =
        "(function(){\n"
            + "  var root = typeof globalThis !== 'undefined' ? globalThis : this;\n"
            + "  var nextCallId = 0;\n"
            + "  root.__fbGenNativeModule = function(config, moduleID) {\n"
            + "    var constants = config[1] || {};\n"
            + "    var methods = config[2] || [];\n"
            + "    var syncMethods = config[4] || [];\n"
            + "    var module = {};\n"
            + "    for (var i = 0; i < methods.length; i += 1) {\n"
            + "      (function(methodID, methodName) {\n"
            + "        module[methodName] = function() {\n"
            + "          var args = Array.prototype.slice.call(arguments);\n"
            + "          if (syncMethods.indexOf(methodID) !== -1) {\n"
            + "            if (typeof root.nativeCallSyncHook !== 'function') {\n"
            + "              throw new Error('nativeCallSyncHook missing');\n"
            + "            }\n"
            + "            return root.nativeCallSyncHook(moduleID, methodID, args);\n"
            + "          }\n"
            + "          if (typeof root.nativeFlushQueueImmediate !== 'function') {\n"
            + "            throw new Error('nativeFlushQueueImmediate missing');\n"
            + "          }\n"
            + "          root.nativeFlushQueueImmediate([[moduleID], [methodID], [args], nextCallId++]);\n"
            + "        };\n"
            + "      })(i, methods[i]);\n"
            + "    }\n"
            + "    for (var key in constants) { module[key] = constants[key]; }\n"
            + "    if (module.getConstants == null) {\n"
            + "      module.getConstants = function() { return constants; };\n"
            + "    }\n"
            + "    return { name: config[0], module: module };\n"
            + "  };\n"
            + "  var moduleProxy = root.nativeModuleProxy;\n"
            + "  if (!moduleProxy) { throw new Error('nativeModuleProxy missing'); }\n"
            + "  var threadSelf = moduleProxy.ThreadSelfModule;\n"
            + "  if (!threadSelf || typeof threadSelf.postMessage !== 'function') {\n"
            + "    throw new Error('ThreadSelfModule.postMessage missing');\n"
            + "  }\n"
            + "  root.__fbBatchedBridge = {\n"
            + "    callFunctionReturnFlushedQueue: function(moduleName, methodName, args) {\n"
            + "      if (moduleName === 'RCTDeviceEventEmitter' && methodName === 'emit') {\n"
            + "        var eventName = args && args[0];\n"
            + "        var message = args && args[1];\n"
            + "        if (eventName === 'msgToThread') {\n"
            + "          var engine = root.HermesInternal ? 'hermes' : 'not-hermes';\n"
            + "          threadSelf.postMessage(engine + ':ack:' + message);\n"
            + "        }\n"
            + "      }\n"
            + "      return null;\n"
            + "    },\n"
            + "    invokeCallbackAndReturnFlushedQueue: function() { return null; },\n"
            + "    flushedQueue: function() { return null; }\n"
            + "  };\n"
            + "})();\n";

    try (FileOutputStream output = new FileOutputStream(bundleFile, false)) {
      output.write(source.getBytes(StandardCharsets.UTF_8));
    }

    return bundleFile;
  }

  private static final class RecordedEvent {
    final String name;
    final ReadableMap params;

    RecordedEvent(String name, @Nullable Object params) {
      this.name = name;
      this.params = (ReadableMap) params;
    }
  }

  private static final class RecordingReactContext extends BridgeReactContext {
    private final List<RecordedEvent> events = new ArrayList<>();
    private CountDownLatch eventLatch = new CountDownLatch(1);

    RecordingReactContext(Context context) {
      super(context);
    }

    @Override
    public <T extends JavaScriptModule> T getJSModule(Class<T> jsInterface) {
      if (jsInterface == DeviceEventManagerModule.RCTDeviceEventEmitter.class) {
        DeviceEventManagerModule.RCTDeviceEventEmitter emitter =
            new DeviceEventManagerModule.RCTDeviceEventEmitter() {
              @Override
              public void emit(String eventName, @Nullable Object data) {
                synchronized (events) {
                  events.add(new RecordedEvent(eventName, data));
                  eventLatch.countDown();
                }
              }
            };
        return jsInterface.cast(emitter);
      }

      return super.getJSModule(jsInterface);
    }

    RecordedEvent awaitEvent(String eventName) throws Exception {
      long deadlineMs = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(10);

      while (System.currentTimeMillis() < deadlineMs) {
        synchronized (events) {
          for (RecordedEvent event : events) {
            if (eventName.equals(event.name)) {
              assertNotNull(event.params);
              return event;
            }
          }
          eventLatch = new CountDownLatch(1);
        }

        eventLatch.await(250, TimeUnit.MILLISECONDS);
      }

      throw new AssertionError("Timed out waiting for event: " + eventName);
    }

    boolean hasEvent(String eventName) {
      synchronized (events) {
        for (RecordedEvent event : events) {
          if (eventName.equals(event.name)) {
            return true;
          }
        }
      }
      return false;
    }
  }
}
