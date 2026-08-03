package com.debank.rabbymobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
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
import java.util.UUID;

public class RNHelpersModule extends SimplePackageSpec {
  public static final String NAME = "RNHelpers";
  private static final String TAG = "RNHelpers";
  private static final long SHARE_CACHE_RETENTION_MS = 6L * 60L * 60L * 1000L;
  private final ReactApplicationContext reactContext;
  private final Handler shareCleanupHandler = new Handler(Looper.getMainLooper());

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

    File shareRootDir = new File(this.reactContext.getCacheDir(), "install/share");
    if (!shareRootDir.exists() && !shareRootDir.mkdirs()) {
      promise.reject("E_SHARE_CACHE_DIR", "Failed to prepare Android share cache directory");
      return;
    }

    cleanupExpiredShareSessions(shareRootDir);

    // A distinct directory produces a distinct FileProvider URI for every share.
    // Never overwrite a path that a previous recipient may still be allowed to read.
    File shareSessionDir = new File(shareRootDir, UUID.randomUUID().toString());
    if (!shareSessionDir.mkdirs()) {
      promise.reject("E_SHARE_CACHE_DIR", "Failed to prepare Android share session directory");
      return;
    }

    File stagedFile = new File(shareSessionDir, sourceFile.getName());

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
        deleteRecursively(shareSessionDir);
        promise.reject("E_SHARE_NO_TARGET", "No Android app can handle sharing this file");
        return;
      }

      Intent chooserIntent = Intent.createChooser(intent, chooserTitle);
      chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
      this.reactContext.startActivity(chooserIntent);
      scheduleShareCleanup(uri, shareSessionDir);
      promise.resolve(null);
    } catch (Exception error) {
      deleteRecursively(shareSessionDir);
      promise.reject("E_SHARE_FILE", error);
    }
  }

  private void scheduleShareCleanup(Uri uri, File shareSessionDir) {
    shareCleanupHandler.postDelayed(
      () -> {
        try {
          this.reactContext.revokeUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION
          );
        } catch (Exception error) {
          Log.w(TAG, "Failed to revoke a shared-file URI permission", error);
        }

        deleteRecursively(shareSessionDir);
      },
      SHARE_CACHE_RETENTION_MS
    );
  }

  private void cleanupExpiredShareSessions(File shareRootDir) {
    File[] sessions = shareRootDir.listFiles();
    if (sessions == null) {
      return;
    }

    long expiredBefore = System.currentTimeMillis() - SHARE_CACHE_RETENTION_MS;
    for (File session : sessions) {
      // Older app versions staged files directly in the root and reused their
      // URI. New shares only create per-session directories, so these legacy
      // files can be revoked and removed immediately.
      boolean isLegacyStagedFile = session.isFile();
      boolean isExpiredSession =
        session.isDirectory() && session.lastModified() < expiredBefore;
      if (isLegacyStagedFile || isExpiredSession) {
        revokeStagedFilePermissions(session);
        deleteRecursively(session);
      }
    }
  }

  private void revokeStagedFilePermissions(File file) {
    if (file.isDirectory()) {
      File[] children = file.listFiles();
      if (children != null) {
        for (File child : children) {
          revokeStagedFilePermissions(child);
        }
      }
      return;
    }

    try {
      Uri uri = FileProvider.getUriForFile(
        this.reactContext,
        this.reactContext.getPackageName() + ".provider",
        file
      );
      this.reactContext.revokeUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      );
    } catch (Exception error) {
      Log.w(TAG, "Failed to revoke an expired shared-file URI permission", error);
    }
  }

  private void deleteRecursively(File file) {
    if (file.isDirectory()) {
      File[] children = file.listFiles();
      if (children != null) {
        for (File child : children) {
          deleteRecursively(child);
        }
      }
    }

    if (file.exists() && !file.delete()) {
      Log.w(TAG, "Failed to delete staged share file: " + file.getAbsolutePath());
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
