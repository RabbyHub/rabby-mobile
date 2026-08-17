package com.debank.rabbymobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.rabbywallet.nativeopenapi.NativeOpenApiDiagnosticCallback;
import com.rabbywallet.nativeopenapi.NativeOpenApiDiagnosticResult;
import com.rabbywallet.nativeopenapi.NativeTokenSyncCallback;
import com.rabbywallet.nativeopenapi.NativeTokenSyncResult;
import com.rabbywallet.nativeopenapi.NativeTokenCacheWriteDiagnosticCallback;
import com.rabbywallet.nativeopenapi.NativeTokenCacheWriteDiagnosticResult;
import com.rabbywallet.nativeopenapi.RabbyNativeOpenApiRuntime;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class RNHelpersModule extends EventEmitterPackageSpec {
  public static final String NAME = "RNHelpers";
  private static final String NATIVE_ASSET_SYNC_COMPLETED_EVENT =
    "@RabbyNativeAssetSyncCompleted";
  private final ReactApplicationContext reactContext;

  public RNHelpersModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  private void emitNativeAssetSyncCompletion(
    String requestId,
    String replacementScope,
    String[] chainIds,
    NativeTokenSyncResult result
  ) {
    WritableArray receiptChainIds = Arguments.createArray();
    for (String chainId : chainIds) {
      receiptChainIds.pushString(chainId);
    }
    WritableMap receipt = Arguments.createMap();
    receipt.putInt("schemaVersion", 1);
    receipt.putString("requestId", requestId);
    receipt.putString("kind", "token");
    receipt.putBoolean("success", result.getSuccess());
    receipt.putString("address", result.getAddress());
    receipt.putDouble("generation", result.getGeneration());
    receipt.putDouble("committedAt", result.getCommittedAtMs());
    receipt.putString("replacementScope", replacementScope);
    receipt.putArray("chainIds", receiptChainIds);
    receipt.putDouble("committedRowCount", result.getCommittedRowCount());
    receipt.putString("stage", result.getStage());
    receipt.putString("error", result.getError());
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(NATIVE_ASSET_SYNC_COMPLETED_EVENT, receipt);
  }

  @Override
  public Map<String, Object> getConstants() {
    Map<String, Object> constants = new HashMap<>();
    constants.put("buildInfo", readBuildInfo());
    return constants;
  }

  private Map<String, Object> readBuildInfo() {
    Map<String, Object> buildInfo = new HashMap<>();

    try (
      BufferedReader reader = new BufferedReader(
        new InputStreamReader(
          reactContext.getAssets().open("rabby-build-info.json"),
          StandardCharsets.UTF_8
        )
      )
    ) {
      StringBuilder json = new StringBuilder();
      char[] buffer = new char[512];
      int count;
      while ((count = reader.read(buffer)) != -1) {
        json.append(buffer, 0, count);
      }

      JSONObject decodedBuildInfo = new JSONObject(json.toString());
      copyBuildInfoValue(decodedBuildInfo, buildInfo, "BUILD_GIT_HASH");
      copyBuildInfoValue(decodedBuildInfo, buildInfo, "BUILD_GIT_HASH_TIME");
      copyBuildInfoValue(decodedBuildInfo, buildInfo, "BUILD_TIME");
      copyBuildInfoValue(decodedBuildInfo, buildInfo, "BUILD_GIT_COMMITOR");
      copyBuildInfoValue(decodedBuildInfo, buildInfo, "METRO_CACHE_ENABLED");
    } catch (IOException | JSONException ignored) {
      // JS keeps its existing defaults when build metadata is unavailable.
    }

    return buildInfo;
  }

  private void copyBuildInfoValue(
    JSONObject source,
    Map<String, Object> destination,
    String key
  ) throws JSONException {
    if (source.has(key) && !source.isNull(key)) {
      destination.put(key, source.get(key));
    }
  }

  @ReactMethod
  public void forceExitApp() {
    android.os.Process.killProcess(android.os.Process.myPid());
  }

  @ReactMethod
  public void androidTraceInstant(String name) {
    RabbyStartupTrace.instant(name);
  }

  @ReactMethod
  public void androidTraceBeginSection(String name) {
    RabbyStartupTrace.beginSection(name);
  }

  @ReactMethod
  public void androidTraceEndSection() {
    RabbyStartupTrace.endSection();
  }

  @ReactMethod
  public void androidTraceBeginAsyncSection(String name, double cookie) {
    RabbyStartupTrace.beginAsyncSection(name, (int) cookie);
  }

  @ReactMethod
  public void androidTraceEndAsyncSection(String name, double cookie) {
    RabbyStartupTrace.endAsyncSection(name, (int) cookie);
  }

  @ReactMethod
  public void androidTraceCounter(String name, double value) {
    RabbyStartupTrace.counter(name, (int) value);
  }

  @ReactMethod
  public void runNativeOpenApiDiagnostic(String address, Promise promise) {
    if (!RabbyStartupTrace.isEnabled()) {
      promise.reject(
        "E_NATIVE_OPENAPI_DIAGNOSTIC_DISABLED",
        "Native OpenAPI diagnostics are disabled in production builds"
      );
      return;
    }

    RabbyNativeOpenApiRuntime.runDiagnostic(
      reactContext,
      BuildConfig.APPLICATION_ID,
      BuildConfig.VERSION_NAME,
      address,
      new NativeOpenApiDiagnosticCallback() {
        @Override
        public void onComplete(NativeOpenApiDiagnosticResult result) {
          WritableMap output = Arguments.createMap();
          output.putBoolean("success", result.getSuccess());
          output.putString("error", result.getError());
          output.putInt("firstStatusCode", result.getFirstStatusCode());
          output.putInt("secondStatusCode", result.getSecondStatusCode());
          output.putDouble("firstDurationMs", result.getFirstDurationMs());
          output.putDouble("secondDurationMs", result.getSecondDurationMs());
          output.putDouble("firstBodyBytes", result.getFirstBodyBytes());
          output.putDouble("secondBodyBytes", result.getSecondBodyBytes());
          output.putString(
            "firstCredentialDisposition",
            result.getFirstCredentialDisposition()
          );
          output.putString(
            "secondCredentialDisposition",
            result.getSecondCredentialDisposition()
          );
          output.putDouble(
            "firstRequestCredentialRevision",
            result.getFirstRequestCredentialRevision()
          );
          output.putDouble(
            "firstCurrentCredentialRevision",
            result.getFirstCurrentCredentialRevision()
          );
          output.putDouble(
            "secondRequestCredentialRevision",
            result.getSecondRequestCredentialRevision()
          );
          output.putDouble(
            "secondCurrentCredentialRevision",
            result.getSecondCurrentCredentialRevision()
          );
          output.putBoolean(
            "secondUsedLatestAvailableCredential",
            result.getSecondUsedLatestAvailableCredential()
          );
          promise.resolve(output);
        }
      }
    );
  }

  @ReactMethod
  public void runNativeTokenCacheSyncDiagnostic(
    String address,
    boolean replaceExisting,
    Promise promise
  ) {
    if (!RabbyStartupTrace.isEnabled()) {
      promise.reject(
        "E_NATIVE_TOKEN_SYNC_DISABLED",
        "Native token sync diagnostics are disabled in production builds"
      );
      return;
    }

    RabbyNativeOpenApiRuntime.syncTokenCache(
      reactContext,
      BuildConfig.APPLICATION_ID,
      BuildConfig.VERSION_NAME,
      address,
      replaceExisting,
      new NativeTokenSyncCallback() {
        @Override
        public void onComplete(NativeTokenSyncResult result) {
          WritableMap output = Arguments.createMap();
          output.putBoolean("success", result.getSuccess());
          output.putString("address", result.getAddress());
          output.putDouble("generation", result.getGeneration());
          output.putString("stage", result.getStage());
          output.putDouble("chainCount", result.getChainCount());
          output.putDouble("sourceTokenCount", result.getSourceTokenCount());
          output.putDouble("filteredTokenCount", result.getFilteredTokenCount());
          output.putDouble("committedRowCount", result.getCommittedRowCount());
          output.putDouble("committedAtMs", result.getCommittedAtMs());
          output.putDouble("durationMs", result.getDurationMs());
          output.putString("error", result.getError());
          promise.resolve(output);
        }
      }
    );
  }

  @ReactMethod
  public void startNativeTokenChains(
    String address,
    ReadableArray chainIds,
    String replacementScope,
    boolean replaceExisting,
    Promise promise
  ) {
    int replacementKind;
    if ("address".equals(replacementScope)) {
      replacementKind = 0;
    } else if ("chains".equals(replacementScope)) {
      replacementKind = 1;
    } else {
      promise.reject(
        "E_NATIVE_TOKEN_SYNC_SCOPE",
        "Native token sync replacement scope is invalid"
      );
      return;
    }

    String[] nativeChainIds = new String[chainIds.size()];
    for (int index = 0; index < chainIds.size(); index += 1) {
      nativeChainIds[index] = chainIds.getString(index);
    }
    String requestId = UUID.randomUUID().toString().toLowerCase();
    RabbyNativeOpenApiRuntime.syncTokenChains(
      reactContext,
      BuildConfig.APPLICATION_ID,
      BuildConfig.VERSION_NAME,
      address,
      nativeChainIds,
      replacementKind,
      replaceExisting,
      new NativeTokenSyncCallback() {
        @Override
        public void onComplete(NativeTokenSyncResult result) {
          emitNativeAssetSyncCompletion(
            requestId,
            replacementScope,
            nativeChainIds,
            result
          );
        }
      }
    );
    WritableMap startResult = Arguments.createMap();
    startResult.putString("requestId", requestId);
    promise.resolve(startResult);
  }

  @ReactMethod
  public void runNativeTokenCacheWriteDiagnostic(Promise promise) {
    if (!RabbyStartupTrace.isEnabled()) {
      promise.reject(
        "E_NATIVE_TOKEN_CACHE_WRITE_DIAGNOSTIC_DISABLED",
        "Native token cache write diagnostics are disabled in production builds"
      );
      return;
    }

    RabbyNativeOpenApiRuntime.runTokenCacheWriteDiagnostic(
      reactContext,
      new NativeTokenCacheWriteDiagnosticCallback() {
        @Override
        public void onComplete(NativeTokenCacheWriteDiagnosticResult result) {
          WritableMap output = Arguments.createMap();
          output.putBoolean("success", result.getSuccess());
          output.putString("stage", result.getStage());
          output.putDouble(
            "attemptedRowCount",
            result.getAttemptedRowCount()
          );
          output.putDouble("durationMs", result.getDurationMs());
          output.putString("error", result.getError());
          promise.resolve(output);
        }
      }
    );
  }

  @ReactMethod
  public void cancelNativeTokenCacheSync(String address) {
    RabbyNativeOpenApiRuntime.cancelTokenCacheSync(address);
  }

  @ReactMethod
  public void cancelAllNativeTokenCacheSyncs() {
    RabbyNativeOpenApiRuntime.cancelAllTokenCacheSyncs();
  }

  @ReactMethod
  public void moveTaskToBack(Promise promise) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      promise.reject(
        "E_MOVE_TASK_TO_BACK_ACTIVITY",
        "Current activity is not available"
      );
      return;
    }

    activity.runOnUiThread(() -> {
      try {
        promise.resolve(activity.moveTaskToBack(true));
      } catch (Exception error) {
        promise.reject("E_MOVE_TASK_TO_BACK", error);
      }
    });
  }

  @ReactMethod
  public void shareFile(ReadableMap options, Promise promise) {
    if (options == null || !options.hasKey("filePath") || options.isNull("filePath")) {
      promise.reject("E_SHARE_INVALID_OPTIONS", "shareFile requires a filePath");
      return;
    }

    String filePath = options.getString("filePath");
    if (filePath == null || filePath.isEmpty()) {
      promise.reject("E_SHARE_INVALID_PATH", "shareFile requires a non-empty filePath");
      return;
    }

    File sourceFile = new File(filePath);
    if (!sourceFile.exists() || !sourceFile.isFile()) {
      promise.reject("E_SHARE_FILE_MISSING", "Share source file missing: " + filePath);
      return;
    }

    File shareDir = new File(this.reactContext.getCacheDir(), "install/share");
    if (!shareDir.exists() && !shareDir.mkdirs()) {
      promise.reject("E_SHARE_CACHE_DIR", "Failed to prepare Android share cache directory");
      return;
    }

    File stagedFile = new File(shareDir, sourceFile.getName());

    try {
      copyFile(sourceFile, stagedFile);

      String mimeType = options.hasKey("mimeType") && !options.isNull("mimeType")
        ? options.getString("mimeType")
        : "application/octet-stream";
      String chooserTitle = options.hasKey("title") && !options.isNull("title")
        ? options.getString("title")
        : "Share file";
      String subject = options.hasKey("subject") && !options.isNull("subject")
        ? options.getString("subject")
        : stagedFile.getName();

      Uri uri = FileProvider.getUriForFile(
        this.reactContext,
        this.reactContext.getPackageName() + ".provider",
        stagedFile
      );

      Intent intent = new Intent(Intent.ACTION_SEND);
      intent.setType(mimeType);
      intent.putExtra(Intent.EXTRA_STREAM, uri);
      intent.putExtra(Intent.EXTRA_SUBJECT, subject);
      intent.setClipData(ClipData.newUri(this.reactContext.getContentResolver(), stagedFile.getName(), uri));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);

      List<ResolveInfo> resolvedActivities =
        this.reactContext.getPackageManager().queryIntentActivities(intent, 0);
      if (resolvedActivities == null || resolvedActivities.isEmpty()) {
        promise.reject("E_SHARE_NO_TARGET", "No Android app can handle sharing this file");
        return;
      }

      for (ResolveInfo resolveInfo : resolvedActivities) {
        this.reactContext.grantUriPermission(
          resolveInfo.activityInfo.packageName,
          uri,
          Intent.FLAG_GRANT_READ_URI_PERMISSION
        );
      }

      Intent chooserIntent = Intent.createChooser(intent, chooserTitle);
      chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
      this.reactContext.startActivity(chooserIntent);
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("E_SHARE_FILE", error);
    }
  }

  private void copyFile(File sourceFile, File targetFile) throws IOException {
    if (targetFile.exists() && !targetFile.delete()) {
      throw new IOException("Failed to overwrite staged share file: " + targetFile.getAbsolutePath());
    }

    try (
      FileInputStream inputStream = new FileInputStream(sourceFile);
      FileOutputStream outputStream = new FileOutputStream(targetFile)
    ) {
      byte[] buffer = new byte[8192];
      int length;

      while ((length = inputStream.read(buffer)) > 0) {
        outputStream.write(buffer, 0, length);
      }

      outputStream.flush();
    }
  }
}
