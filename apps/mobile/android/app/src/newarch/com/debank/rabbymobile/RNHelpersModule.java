package com.debank.rabbymobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.PersistableBundle;
import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.module.annotations.ReactModule;

import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@ReactModule(name = RNHelpersModule.NAME)
public class RNHelpersModule extends NativeRNHelpersSpec {
  public static final String NAME = "RNHelpers";
  private static final int MAX_QR_CODE_PAYLOADS = 10;
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
  protected Map<String, Object> getTypedExportedConstants() {
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
  @Override
  public void forceExitApp() {
    android.os.Process.killProcess(android.os.Process.myPid());
  }

  @ReactMethod
  @Override
  public void measureViewRelativeTo(double anchorTag, double viewportTag, Promise promise) {
    NativeViewGeometry.measureRelativeTo(reactContext, (int) anchorTag, (int) viewportTag, promise);
  }

  @ReactMethod
  @Override
  public void androidTraceInstant(String name) {
    RabbyStartupTrace.instant(name);
  }

  @ReactMethod
  @Override
  public void androidTraceBeginSection(String name) {
    RabbyStartupTrace.beginSection(name);
  }

  @ReactMethod
  @Override
  public void androidTraceEndSection() {
    RabbyStartupTrace.endSection();
  }

  @ReactMethod
  @Override
  public void androidTraceBeginAsyncSection(String name, double cookie) {
    RabbyStartupTrace.beginAsyncSection(name, (int) cookie);
  }

  @ReactMethod
  @Override
  public void androidTraceEndAsyncSection(String name, double cookie) {
    RabbyStartupTrace.endAsyncSection(name, (int) cookie);
  }

  @ReactMethod
  @Override
  public void androidTraceCounter(String name, double value) {
    RabbyStartupTrace.counter(name, (int) value);
  }

  @ReactMethod
  @Override
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
  @Override
  public void setSensitiveClipboard(String text, Promise promise) {
    try {
      ClipData clip = ClipData.newPlainText(null, text);
      PersistableBundle extras = new PersistableBundle();
      extras.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true);
      clip.getDescription().setExtras(extras);
      ClipboardManager clipboard =
        (ClipboardManager) reactContext.getSystemService(Context.CLIPBOARD_SERVICE);
      // Android 13+ handles expiry with a system-controlled timeout.
      clipboard.setPrimaryClip(clip);
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("E_CLIPBOARD", "Failed to copy sensitive content");
    }
  }

  @ReactMethod
  @Override
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

      // Let the chooser grant temporary access only to the selected recipient.
      Intent chooserIntent = Intent.createChooser(intent, chooserTitle);
      chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
      this.reactContext.startActivity(chooserIntent);
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("E_SHARE_FILE", error);
    }
  }

  @Override
  public void iosExcludeFileFromBackup(String filePath, Promise promise) {
    promise.resolve(true);
  }

  @ReactMethod
  @Override
  public void decodeQRCodeFromImageFile(String fileUri, boolean deleteAfterDecode, Promise promise) {
    Uri uri = Uri.parse(fileUri);
    InputImage image;
    try {
      image = InputImage.fromFilePath(reactContext, uri);
    } catch (IOException | RuntimeException error) {
      if (deleteAfterDecode) {
        deleteCachedFile(uri);
      }
      promise.reject("E_QRCODE_READ_IMAGE", "Failed to read image");
      return;
    }

    BarcodeScanner scanner = BarcodeScanning.getClient(
      new BarcodeScannerOptions.Builder()
        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
        .build()
    );
    scanner.process(image)
      .addOnCompleteListener(task -> {
        scanner.close();
        if (deleteAfterDecode) {
          deleteCachedFile(uri);
        }

        if (!task.isSuccessful()) {
          promise.reject("E_QRCODE_DECODE", "Failed to decode QR code");
          return;
        }

        Set<String> payloads = new LinkedHashSet<>();
        for (Barcode barcode : task.getResult()) {
          String payload = barcode.getRawValue();
          if (payload != null && !payload.isEmpty()) {
            payloads.add(payload);
          }
          if (payloads.size() >= MAX_QR_CODE_PAYLOADS) {
            break;
          }
        }

        WritableArray result = Arguments.createArray();
        for (String payload : payloads) {
          result.pushString(payload);
        }
        promise.resolve(result);
      });
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

  // Only remove files inside this app's cache directory, e.g. the copy
  // react-native-image-picker writes after the user picks a photo.
  private void deleteCachedFile(Uri uri) {
    if (!"file".equals(uri.getScheme()) || uri.getPath() == null) {
      return;
    }

    try {
      String cachePath = reactContext.getCacheDir().getCanonicalPath() + File.separator;
      File file = new File(uri.getPath()).getCanonicalFile();
      if (file.getPath().startsWith(cachePath) && file.isFile()) {
        file.delete();
      }
    } catch (IOException ignored) {
      // Cache files are also cleaned by the system when storage is low.
    }
  }
}
