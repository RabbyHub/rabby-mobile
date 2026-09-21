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
import com.facebook.react.bridge.ReadableMap;

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

public class RNHelpersModule extends SimplePackageSpec {
  public static final String NAME = "RNHelpers";
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
