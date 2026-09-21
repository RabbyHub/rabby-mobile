package com.debank.rabbymobile;

import android.Manifest;
import android.app.Activity;
import android.content.ContentUris;
import android.database.Cursor;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.PermissionAwareActivity;
import com.facebook.react.modules.core.PermissionListener;

import java.util.ArrayList;
import java.util.List;

public class RNFileHelpersModule extends SimplePackageSpec implements PermissionListener {
  public static final String NAME = "RNFileHelpers";
  private static final int REQUEST_VISUAL_MEDIA_PERMISSION = 4097;
  private final ReactApplicationContext reactContext;
  private Promise pendingVisualMediaPromise;

  public RNFileHelpersModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void getFileCapabilitySnapshot(Promise promise) {
    promise.resolve(buildFileCapabilitySnapshot());
  }

  @ReactMethod
  public void requestVisualMediaAccess(ReadableMap options, Promise promise) {
    if (this.pendingVisualMediaPromise != null) {
      promise.reject(
        "E_VISUAL_MEDIA_IN_PROGRESS",
        "Another visual media permission request is already in progress"
      );
      return;
    }

    final PermissionAwareActivity activity;
    try {
      activity = getPermissionAwareActivity();
    } catch (IllegalStateException error) {
      promise.reject("E_VISUAL_MEDIA_ACTIVITY", error);
      return;
    }

    String[] permissions = buildVisualMediaPermissionRequest(options);
    if (permissions.length == 0) {
      promise.resolve(buildFileCapabilitySnapshot());
      return;
    }

    this.pendingVisualMediaPromise = promise;
    activity.requestPermissions(
      permissions,
      REQUEST_VISUAL_MEDIA_PERMISSION,
      this
    );
  }

  @ReactMethod
  public void listAccessibleVisualMedia(ReadableMap options, Promise promise) {
    try {
      promise.resolve(queryAccessibleVisualMedia(options));
    } catch (Exception error) {
      promise.reject("E_LIST_ACCESSIBLE_VISUAL_MEDIA", error);
    }
  }

  @Override
  public boolean onRequestPermissionsResult(
    int requestCode,
    @NonNull String[] permissions,
    @NonNull int[] grantResults
  ) {
    if (requestCode != REQUEST_VISUAL_MEDIA_PERMISSION) {
      return false;
    }

    Promise promise = this.pendingVisualMediaPromise;
    this.pendingVisualMediaPromise = null;

    if (promise != null) {
      promise.resolve(buildFileCapabilitySnapshot());
    }

    return true;
  }

  private PermissionAwareActivity getPermissionAwareActivity() {
    Activity activity = getCurrentActivity();

    if (activity == null) {
      throw new IllegalStateException("Current activity is not available");
    }

    if (!(activity instanceof PermissionAwareActivity)) {
      throw new IllegalStateException(
        "Current activity does not implement PermissionAwareActivity"
      );
    }

    return (PermissionAwareActivity) activity;
  }

  private String[] buildVisualMediaPermissionRequest(ReadableMap options) {
    boolean includeImages =
      options == null ||
      !options.hasKey("includeImages") ||
      options.isNull("includeImages") ||
      options.getBoolean("includeImages");
    boolean includeVideos =
      options == null ||
      !options.hasKey("includeVideos") ||
      options.isNull("includeVideos") ||
      options.getBoolean("includeVideos");

    if (!includeImages && !includeVideos) {
      includeImages = true;
      includeVideos = true;
    }

    List<String> permissions = new ArrayList<>();

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      if (includeImages) {
        permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
      }
      if (includeVideos) {
        permissions.add(Manifest.permission.READ_MEDIA_VIDEO);
      }
      permissions.add(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED);
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (includeImages) {
        permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
      }
      if (includeVideos) {
        permissions.add(Manifest.permission.READ_MEDIA_VIDEO);
      }
    } else {
      permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    return permissions.toArray(new String[0]);
  }

  private WritableMap queryAccessibleVisualMedia(ReadableMap options) {
    String mediaType = resolveMediaType(options);
    int limit = resolveMediaQueryLimit(options);
    Uri collectionUri = resolveMediaCollectionUri(mediaType);
    String[] projection = resolveMediaProjection();
    WritableArray items = Arguments.createArray();
    int count = 0;
    boolean truncated = false;

    Cursor cursor = this.reactContext.getContentResolver().query(
      collectionUri,
      projection,
      null,
      null,
      MediaStore.MediaColumns.DATE_ADDED + " DESC"
    );

    if (cursor != null) {
      try {
        int idIndex = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID);
        int nameIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
        int mimeTypeIndex = cursor.getColumnIndex(MediaStore.MediaColumns.MIME_TYPE);
        int sizeIndex = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE);
        int widthIndex = cursor.getColumnIndex(MediaStore.MediaColumns.WIDTH);
        int heightIndex = cursor.getColumnIndex(MediaStore.MediaColumns.HEIGHT);
        int dateAddedIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_ADDED);

        while (cursor.moveToNext()) {
          if (count >= limit) {
            truncated = true;
            break;
          }

          long id = cursor.getLong(idIndex);
          Uri itemUri = ContentUris.withAppendedId(collectionUri, id);
          WritableMap item = Arguments.createMap();
          item.putString("id", String.valueOf(id));
          item.putString("uri", itemUri.toString());
          item.putString(
            "name",
            getCursorString(cursor, nameIndex, mediaType + "-" + id)
          );
          item.putString(
            "mediaType",
            mediaType
          );
          item.putString(
            "mimeType",
            getCursorString(
              cursor,
              mimeTypeIndex,
              "image".equals(mediaType) ? "image/*" : "video/*"
            )
          );
          item.putDouble("sizeBytes", getCursorLong(cursor, sizeIndex));
          item.putInt("width", (int) getCursorLong(cursor, widthIndex));
          item.putInt("height", (int) getCursorLong(cursor, heightIndex));
          item.putDouble("dateAddedMs", getCursorLong(cursor, dateAddedIndex) * 1000d);
          items.pushMap(item);
          count += 1;
        }
      } finally {
        cursor.close();
      }
    }

    WritableMap result = Arguments.createMap();
    result.putString("platform", "android");
    result.putString("mediaType", mediaType);
    result.putInt("limit", limit);
    result.putBoolean("truncated", truncated);
    result.putArray("items", items);
    return result;
  }

  private WritableMap buildFileCapabilitySnapshot() {
    WritableMap snapshot = Arguments.createMap();
    snapshot.putString("platform", "android");
    snapshot.putString("osVersion", String.valueOf(Build.VERSION.RELEASE));
    snapshot.putInt("sdkInt", Build.VERSION.SDK_INT);

    boolean externalStorageGranted =
      Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2 &&
      isPermissionGranted(Manifest.permission.READ_EXTERNAL_STORAGE);
    boolean readImagesGranted =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      isPermissionGranted(Manifest.permission.READ_MEDIA_IMAGES);
    boolean readVideoGranted =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      isPermissionGranted(Manifest.permission.READ_MEDIA_VIDEO);
    boolean userSelectedGranted =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
      isPermissionGranted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED);
    boolean manageAllFilesGranted =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
      Environment.isExternalStorageManager();

    WritableMap visualMedia = Arguments.createMap();
    visualMedia.putString(
      "access",
      resolveVisualMediaAccess(
        externalStorageGranted,
        readImagesGranted,
        readVideoGranted,
        userSelectedGranted
      )
    );
    visualMedia.putBoolean("canRequest", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M);
    visualMedia.putBoolean(
      "canReselect",
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
      userSelectedGranted &&
      !(readImagesGranted && readVideoGranted)
    );
    visualMedia.putString(
      "image",
      resolveMediaPermissionState(externalStorageGranted, readImagesGranted)
    );
    visualMedia.putString(
      "video",
      resolveMediaPermissionState(externalStorageGranted, readVideoGranted)
    );
    visualMedia.putString(
      "userSelected",
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
        ? (userSelectedGranted ? "granted" : "denied")
        : "not-applicable"
    );

    WritableMap sharedFiles = Arguments.createMap();
    sharedFiles.putString(
      "access",
      resolveSharedFilesAccess(externalStorageGranted, manageAllFilesGranted)
    );
    sharedFiles.putBoolean("appSandboxReadable", true);
    sharedFiles.putString(
      "manageAllFiles",
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
        ? (manageAllFilesGranted ? "granted" : "denied")
        : "not-applicable"
    );
    sharedFiles.putString(
      "note",
      manageAllFilesGranted
        ? "All-files access is enabled."
        : "App-owned files remain readable. Shared files outside the sandbox still rely on user-selected URIs or the system picker."
    );

    snapshot.putMap("visualMedia", visualMedia);
    snapshot.putMap("sharedFiles", sharedFiles);
    return snapshot;
  }

  private boolean isPermissionGranted(String permission) {
    return ContextCompat.checkSelfPermission(
      this.reactContext,
      permission
    ) == PackageManager.PERMISSION_GRANTED;
  }

  private String resolveMediaPermissionState(
    boolean externalStorageGranted,
    boolean mediaPermissionGranted
  ) {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
      return externalStorageGranted ? "granted" : "denied";
    }

    return mediaPermissionGranted ? "granted" : "denied";
  }

  private String resolveVisualMediaAccess(
    boolean externalStorageGranted,
    boolean readImagesGranted,
    boolean readVideoGranted,
    boolean userSelectedGranted
  ) {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
      return externalStorageGranted ? "full" : "denied";
    }

    if (readImagesGranted && readVideoGranted) {
      return "full";
    }

    if (userSelectedGranted) {
      return "limited";
    }

    if (readImagesGranted || readVideoGranted) {
      return "partial";
    }

    return "denied";
  }

  private String resolveSharedFilesAccess(
    boolean externalStorageGranted,
    boolean manageAllFilesGranted
  ) {
    if (manageAllFilesGranted) {
      return "all-files";
    }

    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2 && externalStorageGranted) {
      return "broad-read";
    }

    return "selection-required";
  }

  private String resolveMediaType(ReadableMap options) {
    if (
      options != null &&
      options.hasKey("mediaType") &&
      !options.isNull("mediaType")
    ) {
      String mediaType = options.getString("mediaType");
      if ("video".equals(mediaType)) {
        return "video";
      }
    }

    return "image";
  }

  private int resolveMediaQueryLimit(ReadableMap options) {
    if (
      options != null &&
      options.hasKey("limit") &&
      !options.isNull("limit")
    ) {
      return Math.max(1, Math.min(200, (int) Math.floor(options.getDouble("limit"))));
    }

    return 60;
  }

  private Uri resolveMediaCollectionUri(String mediaType) {
    if ("video".equals(mediaType)) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        return MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
      }
      return MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      return MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
    }
    return MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
  }

  private String[] resolveMediaProjection() {
    return new String[] {
      MediaStore.MediaColumns._ID,
      MediaStore.MediaColumns.DISPLAY_NAME,
      MediaStore.MediaColumns.MIME_TYPE,
      MediaStore.MediaColumns.SIZE,
      MediaStore.MediaColumns.WIDTH,
      MediaStore.MediaColumns.HEIGHT,
      MediaStore.MediaColumns.DATE_ADDED,
    };
  }

  private String getCursorString(Cursor cursor, int columnIndex, String fallbackValue) {
    if (columnIndex < 0 || cursor.isNull(columnIndex)) {
      return fallbackValue;
    }

    String value = cursor.getString(columnIndex);
    return value == null || value.isEmpty() ? fallbackValue : value;
  }

  private long getCursorLong(Cursor cursor, int columnIndex) {
    if (columnIndex < 0 || cursor.isNull(columnIndex)) {
      return 0L;
    }

    return cursor.getLong(columnIndex);
  }
}
