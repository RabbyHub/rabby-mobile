package com.debank.rabbymobile;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ImageFormat;
import android.graphics.Paint;
import android.media.Image;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.opengl.EGL14;
import android.opengl.EGLConfig;
import android.opengl.EGLContext;
import android.opengl.EGLDisplay;
import android.opengl.EGLExt;
import android.opengl.EGLSurface;
import android.opengl.GLES20;
import android.opengl.GLUtils;
import android.provider.OpenableColumns;
import android.provider.MediaStore;
import android.net.Uri;
import android.util.Base64;
import android.view.Surface;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.PermissionAwareActivity;
import com.facebook.react.modules.core.PermissionListener;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.common.InputImage;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class RNFileHelpersModule extends SimplePackageSpec implements PermissionListener, ActivityEventListener {
  public static final String NAME = "RNFileHelpers";
  private static final int REQUEST_VISUAL_MEDIA_PERMISSION = 4097;
  private static final int REQUEST_PICK_VIDEO_FILE = 4098;
  private static final int QR_VIDEO_FRAME_RATE = 30;
  private static final int MAX_QR_VIDEO_MATRICES = 2000;
  private static final int MAX_DECODED_QR_CODES = 4096;
  private static final long MAX_QR_VIDEO_FILE_SIZE_BYTES = 200L * 1024L * 1024L;
  private static final long MAX_PICKED_VIDEO_CACHE_AGE_MS =
    6L * 60L * 60L * 1000L;
  private static final String UR_BYTES_PREFIX = "ur:bytes/";
  private final ReactApplicationContext reactContext;
  private final ExecutorService qrVideoExecutor = Executors.newSingleThreadExecutor();
  private final ExecutorService videoFilePickerExecutor =
    Executors.newSingleThreadExecutor();
  private final ConcurrentHashMap<String, AtomicBoolean> qrVideoJobs =
    new ConcurrentHashMap<>();
  private Promise pendingVisualMediaPromise;
  private Promise pendingVideoFilePickerPromise;
  private String pendingVideoFilePickerGeneration;
  private AtomicBoolean pendingVideoFilePickerCancelled;

  public RNFileHelpersModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    this.reactContext.addActivityEventListener(this);
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

  @ReactMethod
  public void pickVideoFile(Promise promise) {
    reactContext.runOnUiQueueThread(() -> {
      if (pendingVideoFilePickerPromise != null) {
        promise.reject(
          "E_VIDEO_FILE_PICKER_IN_PROGRESS",
          "Another video file picker is already in progress"
        );
        return;
      }

      Activity activity = getCurrentActivity();
      if (activity == null) {
        promise.reject(
          "E_VIDEO_FILE_PICKER_ACTIVITY",
          "Current activity is not available"
        );
        return;
      }

      String generation = UUID.randomUUID().toString();
      pendingVideoFilePickerPromise = promise;
      pendingVideoFilePickerGeneration = generation;
      pendingVideoFilePickerCancelled = new AtomicBoolean(false);

      Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      intent.setType("video/*");
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      try {
        activity.startActivityForResult(intent, REQUEST_PICK_VIDEO_FILE);
      } catch (Exception error) {
        clearPendingVideoFilePicker();
        promise.reject("E_VIDEO_FILE_PICKER_OPEN", error);
      }
    });
  }

  @ReactMethod
  public void cancelVideoFilePicker() {
    reactContext.runOnUiQueueThread(() -> {
      Activity activity = getCurrentActivity();
      if (pendingVideoFilePickerPromise != null && activity != null) {
        try {
          activity.finishActivity(REQUEST_PICK_VIDEO_FILE);
        } catch (Exception ignored) {
          // The picker may already have returned while cancellation was queued.
        }
      }
      finishVideoFilePickerWithResult(null);
    });
  }

  @ReactMethod
  public void createQRCodeVideo(
    ReadableMap request,
    Promise promise
  ) {
    final List<QRCodeMatrix> matrices;
    final QRCodeVideoOptions videoOptions;
    try {
      if (
        request == null ||
        !request.hasKey("frames") ||
        request.isNull("frames")
      ) {
        throw new IllegalArgumentException("frames are required");
      }
      matrices = parseQRCodeMatrices(request.getArray("frames"));
      videoOptions = QRCodeVideoOptions.forEncoding(request);
    } catch (Exception error) {
      promise.reject("E_QR_VIDEO_INVALID_INPUT", error);
      return;
    }

    final AtomicBoolean cancelled;
    try {
      cancelled = registerQRCodeVideoJob(videoOptions.jobId);
    } catch (Exception error) {
      promise.reject("E_QR_VIDEO_IN_PROGRESS", error);
      return;
    }
    qrVideoExecutor.execute(() -> {
      try {
        String path = new QRCodeVideoEncoder(
          matrices,
          videoOptions,
          cancelled
        ).encode();
        promise.resolve(path);
      } catch (CancellationException error) {
        promise.reject("E_QR_VIDEO_CANCELLED", error);
      } catch (Exception error) {
        promise.reject("E_QR_VIDEO_ENCODE", error);
      } finally {
        qrVideoJobs.remove(videoOptions.jobId, cancelled);
      }
    });
  }

  @ReactMethod
  public void decodeQRCodesFromVideo(
    ReadableMap request,
    Promise promise
  ) {
    final QRCodeVideoDecodeOptions decodeOptions;
    final String uri;
    try {
      if (
        request == null ||
        !request.hasKey("uri") ||
        request.isNull("uri")
      ) {
        throw new IllegalArgumentException("Video URI is required");
      }
      uri = request.getString("uri");
      decodeOptions = QRCodeVideoDecodeOptions.from(request);
      if (uri == null || uri.trim().isEmpty()) {
        throw new IllegalArgumentException("Video URI is required");
      }
    } catch (Exception error) {
      promise.reject("E_QR_VIDEO_INVALID_INPUT", error);
      return;
    }

    final AtomicBoolean cancelled;
    try {
      cancelled = registerQRCodeVideoJob(decodeOptions.jobId);
    } catch (Exception error) {
      promise.reject("E_QR_VIDEO_IN_PROGRESS", error);
      return;
    }
    qrVideoExecutor.execute(() -> {
      try {
        List<String> values = decodeQRCodesFromVideoFile(
          uri,
          decodeOptions,
          cancelled
        );
        WritableArray result = Arguments.createArray();
        for (String value : values) {
          result.pushString(value);
        }
        promise.resolve(result);
      } catch (CancellationException error) {
        promise.reject("E_QR_VIDEO_CANCELLED", error);
      } catch (Exception error) {
        promise.reject("E_QR_VIDEO_DECODE", error);
      } finally {
        qrVideoJobs.remove(decodeOptions.jobId, cancelled);
      }
    });
  }

  @ReactMethod
  public void cancelQRCodeVideoJob(String jobId) {
    if (jobId == null || jobId.isEmpty()) {
      return;
    }
    AtomicBoolean cancelled = qrVideoJobs.get(jobId);
    if (cancelled != null) {
      cancelled.set(true);
    }
  }

  @Override
  public void onActivityResult(
    Activity activity,
    int requestCode,
    int resultCode,
    Intent data
  ) {
    if (requestCode != REQUEST_PICK_VIDEO_FILE) {
      return;
    }
    if (pendingVideoFilePickerPromise == null) {
      return;
    }
    if (resultCode != Activity.RESULT_OK) {
      finishVideoFilePickerWithResult(null);
      return;
    }

    Uri uri = data == null ? null : data.getData();
    if (uri == null) {
      finishVideoFilePickerWithError(
        "E_VIDEO_FILE_PICKER_INVALID_RESULT",
        new IllegalArgumentException("The selected video file is unavailable")
      );
      return;
    }

    final String generation = pendingVideoFilePickerGeneration;
    final AtomicBoolean cancelled = pendingVideoFilePickerCancelled;
    videoFilePickerExecutor.execute(() -> {
      PickedVideoFile pickedVideoFile = null;
      try {
        pickedVideoFile = copyPickedVideoFile(uri, cancelled);
        final PickedVideoFile result = pickedVideoFile;
        reactContext.runOnUiQueueThread(() -> {
          if (
            generation == null ||
            !generation.equals(pendingVideoFilePickerGeneration) ||
            cancelled == null ||
            cancelled.get()
          ) {
            result.delete();
            return;
          }
          finishVideoFilePickerWithResult(result.toWritableMap());
        });
      } catch (CancellationException error) {
        if (pickedVideoFile != null) {
          pickedVideoFile.delete();
        }
        reactContext.runOnUiQueueThread(() -> {
          if (
            generation != null &&
            generation.equals(pendingVideoFilePickerGeneration)
          ) {
            finishVideoFilePickerWithResult(null);
          }
        });
      } catch (Exception error) {
        if (pickedVideoFile != null) {
          pickedVideoFile.delete();
        }
        reactContext.runOnUiQueueThread(() -> {
          if (
            generation != null &&
            generation.equals(pendingVideoFilePickerGeneration)
          ) {
            finishVideoFilePickerWithError(
              "E_VIDEO_FILE_PICKER_COPY",
              error
            );
          }
        });
      }
    });
  }

  @Override
  public void onNewIntent(Intent intent) {
    // Required by ActivityEventListener; the document picker returns through
    // onActivityResult.
  }

  @Override
  public void invalidate() {
    reactContext.removeActivityEventListener(this);
    AtomicBoolean pickerCancelled = pendingVideoFilePickerCancelled;
    if (pickerCancelled != null) {
      pickerCancelled.set(true);
    }
    Promise pickerPromise = pendingVideoFilePickerPromise;
    clearPendingVideoFilePicker();
    if (pickerPromise != null) {
      pickerPromise.resolve(null);
    }
    for (AtomicBoolean cancelled : qrVideoJobs.values()) {
      cancelled.set(true);
    }
    qrVideoJobs.clear();
    videoFilePickerExecutor.shutdownNow();
    qrVideoExecutor.shutdownNow();
    super.invalidate();
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

  private void finishVideoFilePickerWithResult(WritableMap result) {
    Promise promise = pendingVideoFilePickerPromise;
    if (result == null && pendingVideoFilePickerCancelled != null) {
      pendingVideoFilePickerCancelled.set(true);
    }
    clearPendingVideoFilePicker();
    if (promise != null) {
      promise.resolve(result);
    }
  }

  private void finishVideoFilePickerWithError(String code, Exception error) {
    Promise promise = pendingVideoFilePickerPromise;
    if (pendingVideoFilePickerCancelled != null) {
      pendingVideoFilePickerCancelled.set(true);
    }
    clearPendingVideoFilePicker();
    if (promise != null) {
      promise.reject(code, error);
    }
  }

  private void clearPendingVideoFilePicker() {
    pendingVideoFilePickerPromise = null;
    pendingVideoFilePickerGeneration = null;
    pendingVideoFilePickerCancelled = null;
  }

  private PickedVideoFile copyPickedVideoFile(
    Uri uri,
    AtomicBoolean cancelled
  ) throws Exception {
    ContentResolver resolver = reactContext.getContentResolver();
    String displayName = "wallet-transfer-video";
    long declaredSize = -1L;

    try (
      Cursor cursor = resolver.query(
        uri,
        new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE},
        null,
        null,
        null
      )
    ) {
      if (cursor != null && cursor.moveToFirst()) {
        int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
        if (nameIndex >= 0 && !cursor.isNull(nameIndex)) {
          String candidateName = cursor.getString(nameIndex);
          if (candidateName != null && !candidateName.trim().isEmpty()) {
            displayName = candidateName;
          }
        }
        if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
          declaredSize = cursor.getLong(sizeIndex);
        }
      }
    }

    if (declaredSize > MAX_QR_VIDEO_FILE_SIZE_BYTES) {
      throw new IllegalArgumentException(
        "Video exceeds the 200 MiB size limit"
      );
    }

    String mimeType = resolver.getType(uri);
    String extension = resolvePickedVideoExtension(displayName, mimeType);
    if (
      (mimeType == null || !mimeType.toLowerCase().startsWith("video/")) &&
      !hasKnownVideoExtension(displayName)
    ) {
      throw new IllegalArgumentException("The selected file is not a video");
    }

    File importDirectory = new File(
      reactContext.getCacheDir(),
      "sync-transfer-imports"
    );
    if (!importDirectory.isDirectory() && !importDirectory.mkdirs()) {
      throw new IOException("Unable to create the video import cache");
    }
    deleteStalePickedVideoFiles(importDirectory);
    File outputFile = new File(
      importDirectory,
      UUID.randomUUID().toString() + extension
    );

    long copiedBytes = 0L;
    try (
      InputStream input = resolver.openInputStream(uri);
      OutputStream output = new FileOutputStream(outputFile)
    ) {
      if (input == null) {
        throw new IOException("Unable to open the selected video");
      }
      byte[] buffer = new byte[64 * 1024];
      while (true) {
        if (
          cancelled == null ||
          cancelled.get() ||
          Thread.currentThread().isInterrupted()
        ) {
          throw new CancellationException("Video file selection was cancelled");
        }
        int count = input.read(buffer);
        if (count < 0) {
          break;
        }
        copiedBytes += count;
        if (copiedBytes > MAX_QR_VIDEO_FILE_SIZE_BYTES) {
          throw new IllegalArgumentException(
            "Video exceeds the 200 MiB size limit"
          );
        }
        output.write(buffer, 0, count);
      }
      output.flush();
    } catch (Exception error) {
      if (outputFile.exists()) {
        outputFile.delete();
      }
      throw error;
    }

    if (copiedBytes <= 0L) {
      outputFile.delete();
      throw new IllegalArgumentException("The selected video is empty");
    }
    return new PickedVideoFile(
      outputFile,
      displayName,
      mimeType == null ? "video/mp4" : mimeType,
      copiedBytes
    );
  }

  private static String resolvePickedVideoExtension(
    String displayName,
    String mimeType
  ) {
    int dotIndex = displayName == null ? -1 : displayName.lastIndexOf('.');
    if (dotIndex >= 0 && dotIndex < displayName.length() - 1) {
      String candidate = displayName.substring(dotIndex + 1).toLowerCase();
      if (candidate.length() <= 10 && candidate.matches("[a-z0-9]+")) {
        return "." + candidate;
      }
    }
    if ("video/quicktime".equalsIgnoreCase(mimeType)) {
      return ".mov";
    }
    if ("video/x-m4v".equalsIgnoreCase(mimeType)) {
      return ".m4v";
    }
    if ("video/webm".equalsIgnoreCase(mimeType)) {
      return ".webm";
    }
    return ".mp4";
  }

  private static boolean isKnownVideoExtension(String extension) {
    return ".mp4".equals(extension) ||
      ".m4v".equals(extension) ||
      ".mov".equals(extension) ||
      ".webm".equals(extension);
  }

  private static boolean hasKnownVideoExtension(String fileName) {
    if (fileName == null) {
      return false;
    }
    int dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 &&
      dotIndex < fileName.length() - 1 &&
      isKnownVideoExtension(
        "." + fileName.substring(dotIndex + 1).toLowerCase()
      );
  }

  private static void deleteStalePickedVideoFiles(File importDirectory) {
    File[] files = importDirectory.listFiles();
    if (files == null) {
      return;
    }
    long now = System.currentTimeMillis();
    for (File file : files) {
      long age = now - file.lastModified();
      if (file.isFile() && age > MAX_PICKED_VIDEO_CACHE_AGE_MS) {
        file.delete();
      }
    }
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

  private AtomicBoolean registerQRCodeVideoJob(String jobId) {
    AtomicBoolean cancelled = new AtomicBoolean(false);
    AtomicBoolean previous = qrVideoJobs.putIfAbsent(jobId, cancelled);
    if (previous != null) {
      throw new IllegalStateException(
        "A QR video job with the same jobId is already running"
      );
    }
    return cancelled;
  }

  private List<QRCodeMatrix> parseQRCodeMatrices(ReadableArray frames) {
    if (frames == null || frames.size() == 0) {
      throw new IllegalArgumentException("At least one QR matrix is required");
    }
    if (frames.size() > MAX_QR_VIDEO_MATRICES) {
      throw new IllegalArgumentException("Too many QR matrices");
    }

    List<QRCodeMatrix> result = new ArrayList<>(frames.size());
    for (int index = 0; index < frames.size(); index += 1) {
      ReadableMap frame = frames.getMap(index);
      if (
        frame == null ||
        !frame.hasKey("size") ||
        frame.isNull("size") ||
        !frame.hasKey("data") ||
        frame.isNull("data")
      ) {
        throw new IllegalArgumentException("Invalid QR matrix at index " + index);
      }
      result.add(
        new QRCodeMatrix(
          (int) Math.floor(frame.getDouble("size")),
          frame.getString("data")
        )
      );
    }
    return result;
  }

  private List<String> decodeQRCodesFromVideoFile(
    String uriValue,
    QRCodeVideoDecodeOptions options,
    AtomicBoolean cancelled
  ) throws Exception {
    MediaExtractor extractor = new MediaExtractor();
    MediaCodec decoder = null;
    boolean decoderStarted = false;
    BarcodeScanner scanner = BarcodeScanning.getClient(
      new BarcodeScannerOptions.Builder()
        .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
        .build()
    );

    try {
      enforceQRCodeVideoFileSizeLimit(uriValue);
      setExtractorDataSource(extractor, uriValue);

      int videoTrackIndex = -1;
      MediaFormat videoFormat = null;
      String mimeType = null;
      for (int trackIndex = 0; trackIndex < extractor.getTrackCount(); trackIndex += 1) {
        MediaFormat candidateFormat = extractor.getTrackFormat(trackIndex);
        String candidateMime = candidateFormat.getString(MediaFormat.KEY_MIME);
        if (candidateMime != null && candidateMime.startsWith("video/")) {
          videoTrackIndex = trackIndex;
          videoFormat = candidateFormat;
          mimeType = candidateMime;
          break;
        }
      }
      if (videoTrackIndex < 0 || videoFormat == null || mimeType == null) {
        throw new IllegalArgumentException("The selected file has no video track");
      }

      long durationUs = readRequiredLong(
        videoFormat,
        MediaFormat.KEY_DURATION,
        "Video duration is unavailable"
      );
      if (durationUs <= 0L) {
        throw new IllegalArgumentException("Video duration must be positive");
      }
      if (durationUs > options.maxDurationSeconds * 1_000_000L) {
        throw new IllegalArgumentException("Video exceeds the duration limit");
      }

      validateVideoDimensions(
        videoFormat,
        options.maxDimension,
        "Video dimensions are invalid or exceed the limit"
      );
      int rotationDegrees = normalizeVideoRotation(
        videoFormat.containsKey(MediaFormat.KEY_ROTATION)
          ? videoFormat.getInteger(MediaFormat.KEY_ROTATION)
          : 0
      );

      extractor.selectTrack(videoTrackIndex);
      videoFormat.setInteger(
        MediaFormat.KEY_COLOR_FORMAT,
        MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible
      );
      decoder = MediaCodec.createDecoderByType(mimeType);
      decoder.configure(videoFormat, null, null, 0);
      decoder.start();
      decoderStarted = true;

      Set<String> decodedValues = new LinkedHashSet<>();
      UROriginalPartTracker originalPartTracker = new UROriginalPartTracker();
      long sampleIntervalUs = options.sampleIntervalMs * 1000L;
      long nextSampleUs = Math.max(
        0L,
        Math.min(sampleIntervalUs / 2L, durationUs - 1L)
      );
      boolean inputEnded = false;
      boolean outputEnded = false;
      boolean originalPartsComplete = false;
      MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();

      while (!outputEnded && !originalPartsComplete) {
        throwIfCancelled(cancelled);

        if (!inputEnded) {
          int inputIndex = decoder.dequeueInputBuffer(10_000L);
          if (inputIndex >= 0) {
            ByteBuffer inputBuffer = decoder.getInputBuffer(inputIndex);
            if (inputBuffer == null) {
              throw new IllegalStateException("Video decoder input buffer is unavailable");
            }
            inputBuffer.clear();
            int sampleSize = extractor.readSampleData(inputBuffer, 0);
            if (sampleSize < 0) {
              decoder.queueInputBuffer(
                inputIndex,
                0,
                0,
                0L,
                MediaCodec.BUFFER_FLAG_END_OF_STREAM
              );
              inputEnded = true;
            } else {
              long presentationTimeUs = extractor.getSampleTime();
              decoder.queueInputBuffer(
                inputIndex,
                0,
                sampleSize,
                Math.max(0L, presentationTimeUs),
                0
              );
              extractor.advance();
            }
          }
        }

        int outputIndex = decoder.dequeueOutputBuffer(bufferInfo, 10_000L);
        if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          validateVideoDimensions(
            decoder.getOutputFormat(),
            options.maxDimension,
            "Decoded video dimensions are invalid or exceed the limit"
          );
          continue;
        }
        if (outputIndex < 0) {
          continue;
        }

        Image outputImage = null;
        try {
          boolean isCodecConfig =
            (bufferInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0;
          boolean shouldScan =
            !isCodecConfig &&
            bufferInfo.size > 0 &&
            bufferInfo.presentationTimeUs + 100L >= nextSampleUs;
          if (shouldScan) {
            outputImage = decoder.getOutputImage(outputIndex);
            if (outputImage == null) {
              throw new IllegalStateException("Video decoder did not return an image frame");
            }
            if (outputImage.getFormat() != ImageFormat.YUV_420_888) {
              throw new IllegalStateException("Video decoder returned an unsupported image format");
            }
            validateVideoDimensions(
              outputImage.getWidth(),
              outputImage.getHeight(),
              options.maxDimension,
              "Decoded video dimensions are invalid or exceed the limit"
            );

            List<Barcode> barcodes = Tasks.await(
              scanner.process(InputImage.fromMediaImage(outputImage, rotationDegrees)),
              10,
              TimeUnit.SECONDS
            );
            for (Barcode barcode : barcodes) {
              String value = barcode.getRawValue();
              if (value == null || value.isEmpty() || value.length() > 4096) {
                continue;
              }
              boolean added = decodedValues.add(value);
              if (decodedValues.size() > MAX_DECODED_QR_CODES) {
                throw new IllegalArgumentException("Video contains too many QR codes");
              }
              if (added && originalPartTracker.record(value)) {
                originalPartsComplete = true;
                break;
              }
            }

            do {
              nextSampleUs += sampleIntervalUs;
            } while (nextSampleUs <= bufferInfo.presentationTimeUs);
          } else {
            outputEnded =
              (bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
          }
          if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
            outputEnded = true;
          }
        } finally {
          if (outputImage != null) {
            outputImage.close();
          }
          decoder.releaseOutputBuffer(outputIndex, false);
        }
      }

      throwIfCancelled(cancelled);
      return new ArrayList<>(decodedValues);
    } finally {
      scanner.close();
      if (decoder != null) {
        if (decoderStarted) {
          try {
            decoder.stop();
          } catch (IllegalStateException ignored) {
            // Best-effort native resource cleanup.
          }
        }
        decoder.release();
      }
      extractor.release();
    }
  }

  private void enforceQRCodeVideoFileSizeLimit(String uriValue) throws IOException {
    Uri uri = Uri.parse(uriValue);
    String scheme = uri.getScheme();
    long fileSize;
    if (scheme == null || scheme.isEmpty() || "file".equalsIgnoreCase(scheme)) {
      String path = scheme == null || scheme.isEmpty() ? uriValue : uri.getPath();
      if (path == null || path.isEmpty()) {
        throw new IllegalArgumentException("Invalid video file URI");
      }
      File file = new File(path);
      if (!file.isFile()) {
        throw new IllegalArgumentException("Video file does not exist");
      }
      fileSize = file.length();
    } else if ("content".equalsIgnoreCase(scheme)) {
      try (
        AssetFileDescriptor descriptor = reactContext
          .getContentResolver()
          .openAssetFileDescriptor(uri, "r")
      ) {
        if (descriptor == null) {
          throw new IllegalArgumentException("Unable to open the selected video");
        }
        fileSize = descriptor.getLength();
        if (fileSize == AssetFileDescriptor.UNKNOWN_LENGTH) {
          ParcelFileDescriptor parcelDescriptor = descriptor.getParcelFileDescriptor();
          fileSize = parcelDescriptor == null
            ? -1L
            : parcelDescriptor.getStatSize();
        }
      }
    } else {
      throw new IllegalArgumentException(
        "Only file and content video URIs are supported"
      );
    }

    if (fileSize < 0L) {
      throw new IllegalArgumentException("Video file size is unavailable");
    }
    if (fileSize > MAX_QR_VIDEO_FILE_SIZE_BYTES) {
      throw new IllegalArgumentException("Video exceeds the 200 MiB size limit");
    }
  }

  private void setExtractorDataSource(MediaExtractor extractor, String uriValue)
    throws IOException {
    Uri uri = Uri.parse(uriValue);
    String scheme = uri.getScheme();
    if (scheme == null || scheme.isEmpty()) {
      extractor.setDataSource(uriValue);
      return;
    }
    if ("file".equalsIgnoreCase(scheme)) {
      String path = uri.getPath();
      if (path == null || path.isEmpty()) {
        throw new IllegalArgumentException("Invalid file URI");
      }
      extractor.setDataSource(path);
      return;
    }
    if ("content".equalsIgnoreCase(scheme)) {
      extractor.setDataSource(reactContext, uri, null);
      return;
    }
    throw new IllegalArgumentException("Only file and content video URIs are supported");
  }

  private static long readRequiredLong(
    MediaFormat format,
    String key,
    String errorMessage
  ) {
    if (!format.containsKey(key)) {
      throw new IllegalArgumentException(errorMessage);
    }
    try {
      return format.getLong(key);
    } catch (ClassCastException | NullPointerException error) {
      throw new IllegalArgumentException(errorMessage, error);
    }
  }

  private static void validateVideoDimensions(
    MediaFormat format,
    int maxDimension,
    String errorMessage
  ) {
    if (
      !format.containsKey(MediaFormat.KEY_WIDTH) ||
      !format.containsKey(MediaFormat.KEY_HEIGHT)
    ) {
      throw new IllegalArgumentException(errorMessage);
    }
    try {
      validateVideoDimensions(
        format.getInteger(MediaFormat.KEY_WIDTH),
        format.getInteger(MediaFormat.KEY_HEIGHT),
        maxDimension,
        errorMessage
      );
    } catch (ClassCastException | NullPointerException error) {
      throw new IllegalArgumentException(errorMessage, error);
    }
  }

  private static void validateVideoDimensions(
    int width,
    int height,
    int maxDimension,
    String errorMessage
  ) {
    if (
      width <= 0 ||
      height <= 0 ||
      width > maxDimension ||
      height > maxDimension
    ) {
      throw new IllegalArgumentException(errorMessage);
    }
  }

  private static int normalizeVideoRotation(int rotationDegrees) {
    int normalized = ((rotationDegrees % 360) + 360) % 360;
    if (normalized == 0 || normalized == 90 || normalized == 180 || normalized == 270) {
      return normalized;
    }
    throw new IllegalArgumentException("Video rotation metadata is invalid");
  }

  private static void throwIfCancelled(AtomicBoolean cancelled) {
    if (cancelled.get() || Thread.currentThread().isInterrupted()) {
      throw new CancellationException("QR video job was cancelled");
    }
  }

  private static int readIntOption(
    ReadableMap options,
    String key,
    int fallback,
    int minimum,
    int maximum
  ) {
    if (options == null || !options.hasKey(key) || options.isNull(key)) {
      return fallback;
    }
    int value = (int) Math.floor(options.getDouble(key));
    if (value < minimum || value > maximum) {
      throw new IllegalArgumentException(key + " is outside the supported range");
    }
    return value;
  }

  private static String readJobId(ReadableMap options) {
    if (
      options != null &&
      options.hasKey("jobId") &&
      !options.isNull("jobId")
    ) {
      String jobId = options.getString("jobId");
      if (jobId != null && !jobId.trim().isEmpty() && jobId.length() <= 128) {
        return jobId;
      }
      throw new IllegalArgumentException("jobId is invalid");
    }
    return UUID.randomUUID().toString();
  }

  private static File resolveOutputFile(String outputPath) throws IOException {
    if (outputPath == null || outputPath.trim().isEmpty()) {
      throw new IllegalArgumentException("outputPath is required");
    }
    Uri uri = Uri.parse(outputPath);
    String scheme = uri.getScheme();
    String path;
    if (scheme == null || scheme.isEmpty()) {
      path = outputPath;
    } else if ("file".equalsIgnoreCase(scheme)) {
      path = uri.getPath();
    } else {
      throw new IllegalArgumentException("outputPath must be a file path");
    }
    if (path == null || path.isEmpty() || !path.toLowerCase().endsWith(".mp4")) {
      throw new IllegalArgumentException("outputPath must end with .mp4");
    }

    File outputFile = new File(path).getCanonicalFile();
    File parent = outputFile.getParentFile();
    if (parent == null || (!parent.exists() && !parent.mkdirs())) {
      throw new IOException("Unable to prepare the output directory");
    }
    if (outputFile.exists() && !outputFile.delete()) {
      throw new IOException("Unable to replace the output video");
    }
    return outputFile;
  }

  /**
   * A multipart BC-UR fountain starts with the original fragments numbered
   * 1..seqLen, followed by redundant mixed fragments. Once every original
   * fragment has been observed, decoding the second pass cannot add anything
   * needed by the JS UR decoder, so video scanning can stop early.
   */
  private static final class PickedVideoFile {
    final File file;
    final String fileName;
    final String mimeType;
    final long fileSize;

    PickedVideoFile(
      File file,
      String fileName,
      String mimeType,
      long fileSize
    ) {
      this.file = file;
      this.fileName = fileName;
      this.mimeType = mimeType;
      this.fileSize = fileSize;
    }

    WritableMap toWritableMap() {
      WritableMap result = Arguments.createMap();
      result.putString("uri", Uri.fromFile(file).toString());
      result.putString("cleanupPath", file.getAbsolutePath());
      result.putString("fileName", fileName);
      result.putString("type", mimeType);
      result.putDouble("fileSize", fileSize);
      return result;
    }

    void delete() {
      if (file.exists()) {
        file.delete();
      }
    }
  }

  private static final class UROriginalPartTracker {
    private int expectedPartCount = 0;
    private final BitSet originalParts = new BitSet();

    boolean record(String value) {
      if (
        value == null ||
        value.length() <= UR_BYTES_PREFIX.length() ||
        !value.regionMatches(
          true,
          0,
          UR_BYTES_PREFIX,
          0,
          UR_BYTES_PREFIX.length()
        )
      ) {
        return false;
      }

      int sequenceEnd = value.indexOf('/', UR_BYTES_PREFIX.length());
      if (sequenceEnd <= UR_BYTES_PREFIX.length()) {
        return false;
      }
      String sequence = value.substring(UR_BYTES_PREFIX.length(), sequenceEnd);
      int separator = sequence.indexOf('-');
      if (separator <= 0 || separator != sequence.lastIndexOf('-')) {
        return false;
      }
      int sequenceNumber = parsePositiveDecimal(sequence.substring(0, separator));
      int sequenceLength = parsePositiveDecimal(sequence.substring(separator + 1));
      if (
        sequenceNumber <= 0 ||
        sequenceLength <= 0 ||
        sequenceLength > MAX_QR_VIDEO_MATRICES ||
        sequenceNumber > sequenceLength
      ) {
        return false;
      }
      if (expectedPartCount == 0) {
        expectedPartCount = sequenceLength;
      } else if (expectedPartCount != sequenceLength) {
        return false;
      }

      originalParts.set(sequenceNumber - 1);
      return originalParts.cardinality() == expectedPartCount;
    }

    private static int parsePositiveDecimal(String value) {
      if (value == null || value.isEmpty()) {
        return -1;
      }
      int result = 0;
      for (int index = 0; index < value.length(); index += 1) {
        char character = value.charAt(index);
        if (character < '0' || character > '9') {
          return -1;
        }
        int digit = character - '0';
        if (result > (Integer.MAX_VALUE - digit) / 10) {
          return -1;
        }
        result = result * 10 + digit;
      }
      return result;
    }
  }

  private static final class QRCodeMatrix {
    final int size;
    final byte[] bits;

    QRCodeMatrix(int size, String base64Data) {
      if (size < 21 || size > 177) {
        throw new IllegalArgumentException("QR matrix size is invalid");
      }
      if (base64Data == null || base64Data.isEmpty()) {
        throw new IllegalArgumentException("QR matrix data is required");
      }
      byte[] decoded;
      try {
        decoded = Base64.decode(base64Data, Base64.DEFAULT);
      } catch (IllegalArgumentException error) {
        throw new IllegalArgumentException("QR matrix data is not valid base64", error);
      }
      int expectedLength = (size * size + 7) / 8;
      if (decoded.length != expectedLength) {
        throw new IllegalArgumentException("QR matrix data length is invalid");
      }
      this.size = size;
      this.bits = decoded;
    }

    boolean isDark(int row, int column) {
      int bitIndex = row * size + column;
      int value = bits[bitIndex >> 3] & 0xFF;
      return ((value >> (7 - (bitIndex & 7))) & 1) != 0;
    }
  }

  private static final class QRCodeVideoOptions {
    final String outputPath;
    final int size;
    final int frameDurationMs;
    final int bitRate;
    final int tailFrames;
    final int quietZoneModules;
    final String jobId;

    private QRCodeVideoOptions(
      String outputPath,
      int size,
      int frameDurationMs,
      int bitRate,
      int tailFrames,
      int quietZoneModules,
      String jobId
    ) {
      this.outputPath = outputPath;
      this.size = size;
      this.frameDurationMs = frameDurationMs;
      this.bitRate = bitRate;
      this.tailFrames = tailFrames;
      this.quietZoneModules = quietZoneModules;
      this.jobId = jobId;
    }

    static QRCodeVideoOptions forEncoding(ReadableMap options) {
      if (
        options == null ||
        !options.hasKey("outputPath") ||
        options.isNull("outputPath")
      ) {
        throw new IllegalArgumentException("outputPath is required");
      }
      String outputPath = options.getString("outputPath");
      int size = readIntOption(options, "size", 1024, 256, 2048);
      if ((size & 1) != 0) {
        throw new IllegalArgumentException("size must be even");
      }
      return new QRCodeVideoOptions(
        outputPath,
        size,
        readIntOption(options, "frameDurationMs", 200, 50, 2000),
        readIntOption(options, "bitRate", 4_000_000, 500_000, 20_000_000),
        readIntOption(options, "tailFrames", 2, 0, 30),
        readIntOption(options, "quietZoneModules", 4, 0, 16),
        readJobId(options)
      );
    }
  }

  private static final class QRCodeVideoDecodeOptions {
    final int sampleIntervalMs;
    final int maxDurationSeconds;
    final int maxDimension;
    final String jobId;

    private QRCodeVideoDecodeOptions(
      int sampleIntervalMs,
      int maxDurationSeconds,
      int maxDimension,
      String jobId
    ) {
      this.sampleIntervalMs = sampleIntervalMs;
      this.maxDurationSeconds = maxDurationSeconds;
      this.maxDimension = maxDimension;
      this.jobId = jobId;
    }

    static QRCodeVideoDecodeOptions from(ReadableMap options) {
      return new QRCodeVideoDecodeOptions(
        readIntOption(options, "sampleIntervalMs", 100, 40, 1000),
        readIntOption(options, "maxDurationSeconds", 381, 1, 1800),
        readIntOption(options, "maxDimension", 1280, 256, 2048),
        readJobId(options)
      );
    }
  }

  private static final class QRCodeVideoEncoder {
    private final List<QRCodeMatrix> matrices;
    private final QRCodeVideoOptions options;
    private final AtomicBoolean cancelled;
    private MediaCodec codec;
    private MediaMuxer muxer;
    private Surface codecInputSurface;
    private EGLInputSurface eglInputSurface;
    private QRTextureRenderer textureRenderer;
    private int videoTrackIndex = -1;
    private boolean muxerStarted = false;
    private boolean muxerStopped = false;
    private boolean completed = false;

    QRCodeVideoEncoder(
      List<QRCodeMatrix> matrices,
      QRCodeVideoOptions options,
      AtomicBoolean cancelled
    ) {
      this.matrices = matrices;
      this.options = options;
      this.cancelled = cancelled;
    }

    String encode() throws Exception {
      File outputFile = resolveOutputFile(options.outputPath);
      Bitmap bitmap = null;
      try {
        codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
        MediaFormat preferredFormat = createVideoFormat(codec, true);
        try {
          codec.configure(
            preferredFormat,
            null,
            null,
            MediaCodec.CONFIGURE_FLAG_ENCODE
          );
        } catch (RuntimeException preferredError) {
          // Some vendor codecs advertise Baseline/VBR support but reject the
          // exact profile-level combination at configure time. Retry with only
          // the universally required AVC surface settings and let the codec
          // choose its compatible profile and bitrate mode.
          codec.release();
          codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
          try {
            codec.configure(
              createVideoFormat(codec, false),
              null,
              null,
              MediaCodec.CONFIGURE_FLAG_ENCODE
            );
          } catch (RuntimeException fallbackError) {
            fallbackError.addSuppressed(preferredError);
            throw fallbackError;
          }
        }
        codecInputSurface = codec.createInputSurface();
        codec.start();
        muxer = new MediaMuxer(
          outputFile.getAbsolutePath(),
          MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4
        );
        eglInputSurface = new EGLInputSurface(codecInputSurface);
        eglInputSurface.makeCurrent();
        textureRenderer = new QRTextureRenderer(options.size, options.size);
        bitmap = Bitmap.createBitmap(
          options.size,
          options.size,
          Bitmap.Config.ARGB_8888
        );

        int repeatsPerMatrix = Math.max(
          1,
          Math.round(options.frameDurationMs * QR_VIDEO_FRAME_RATE / 1000f)
        );
        long frameIndex = 0L;
        for (QRCodeMatrix matrix : matrices) {
          throwIfCancelled(cancelled);
          renderMatrix(bitmap, matrix, options.quietZoneModules);
          textureRenderer.upload(bitmap);
          for (int repeat = 0; repeat < repeatsPerMatrix; repeat += 1) {
            throwIfCancelled(cancelled);
            textureRenderer.draw();
            eglInputSurface.setPresentationTime(
              frameIndex * 1_000_000_000L / QR_VIDEO_FRAME_RATE
            );
            if (!eglInputSurface.swapBuffers()) {
              throw new IOException("Failed to submit a QR video frame");
            }
            drainEncoder(false);
            frameIndex += 1L;
          }
        }

        int tailVideoFrames = options.tailFrames * repeatsPerMatrix;
        for (int index = 0; index < tailVideoFrames; index += 1) {
          throwIfCancelled(cancelled);
          textureRenderer.draw();
          eglInputSurface.setPresentationTime(
            frameIndex * 1_000_000_000L / QR_VIDEO_FRAME_RATE
          );
          if (!eglInputSurface.swapBuffers()) {
            throw new IOException("Failed to submit a QR video tail frame");
          }
          drainEncoder(false);
          frameIndex += 1L;
        }

        codec.signalEndOfInputStream();
        drainEncoder(true);
        stopMuxer();
        throwIfCancelled(cancelled);
        completed = true;
        return outputFile.getAbsolutePath();
      } finally {
        if (bitmap != null && !bitmap.isRecycled()) {
          bitmap.recycle();
        }
        release();
        if (!completed && outputFile.exists()) {
          outputFile.delete();
        }
      }
    }

    private MediaFormat createVideoFormat(
      MediaCodec targetCodec,
      boolean includePreferredCapabilities
    ) {
      MediaFormat format = MediaFormat.createVideoFormat(
        MediaFormat.MIMETYPE_VIDEO_AVC,
        options.size,
        options.size
      );
      format.setInteger(
        MediaFormat.KEY_COLOR_FORMAT,
        MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface
      );
      format.setInteger(MediaFormat.KEY_BIT_RATE, options.bitRate);
      format.setInteger(MediaFormat.KEY_FRAME_RATE, QR_VIDEO_FRAME_RATE);
      format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1);
      if (!includePreferredCapabilities) {
        return format;
      }

      try {
        MediaCodecInfo.CodecCapabilities capabilities = targetCodec
          .getCodecInfo()
          .getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC);
        if (
          capabilities
            .getEncoderCapabilities()
            .isBitrateModeSupported(
              MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR
            )
        ) {
          format.setInteger(
            MediaFormat.KEY_BITRATE_MODE,
            MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR
          );
        }

        boolean supportsBaselineLevel4 = false;
        for (
          MediaCodecInfo.CodecProfileLevel profileLevel :
          capabilities.profileLevels
        ) {
          if (
            profileLevel.profile ==
              MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline &&
            profileLevel.level >= MediaCodecInfo.CodecProfileLevel.AVCLevel4
          ) {
            supportsBaselineLevel4 = true;
            break;
          }
        }
        if (supportsBaselineLevel4) {
          format.setInteger(
            MediaFormat.KEY_PROFILE,
            MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline
          );
          format.setInteger(
            MediaFormat.KEY_LEVEL,
            MediaCodecInfo.CodecProfileLevel.AVCLevel4
          );
        }
      } catch (RuntimeException ignored) {
        // Capability queries are advisory. The configure fallback above is the
        // final compatibility guard for incomplete vendor codec metadata.
      }
      return format;
    }

    private void drainEncoder(boolean endOfStream) throws IOException {
      MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
      while (true) {
        int outputBufferIndex = codec.dequeueOutputBuffer(
          bufferInfo,
          endOfStream ? 10_000L : 0L
        );
        if (outputBufferIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
          if (!endOfStream) {
            return;
          }
          throwIfCancelled(cancelled);
          continue;
        }
        if (outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          if (muxerStarted) {
            throw new IOException("Video encoder output format changed twice");
          }
          videoTrackIndex = muxer.addTrack(codec.getOutputFormat());
          muxer.start();
          muxerStarted = true;
          continue;
        }
        if (outputBufferIndex < 0) {
          continue;
        }

        ByteBuffer encodedData = codec.getOutputBuffer(outputBufferIndex);
        if (encodedData == null) {
          throw new IOException("Video encoder returned an empty output buffer");
        }
        if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
          bufferInfo.size = 0;
        }
        if (bufferInfo.size > 0) {
          if (!muxerStarted) {
            throw new IOException("Video muxer has not started");
          }
          encodedData.position(bufferInfo.offset);
          encodedData.limit(bufferInfo.offset + bufferInfo.size);
          muxer.writeSampleData(videoTrackIndex, encodedData, bufferInfo);
        }
        boolean reachedEnd =
          (bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
        codec.releaseOutputBuffer(outputBufferIndex, false);
        if (reachedEnd) {
          return;
        }
      }
    }

    private void renderMatrix(
      Bitmap bitmap,
      QRCodeMatrix matrix,
      int quietZoneModules
    ) {
      bitmap.eraseColor(Color.WHITE);
      int moduleScale = Math.max(
        1,
        options.size / (matrix.size + quietZoneModules * 2)
      );
      int renderedSize = matrix.size * moduleScale;
      int left = (options.size - renderedSize) / 2;
      int top = (options.size - renderedSize) / 2;
      Canvas canvas = new Canvas(bitmap);
      Paint paint = new Paint();
      paint.setColor(Color.BLACK);
      paint.setStyle(Paint.Style.FILL);
      paint.setAntiAlias(false);
      paint.setFilterBitmap(false);

      for (int row = 0; row < matrix.size; row += 1) {
        int column = 0;
        while (column < matrix.size) {
          while (column < matrix.size && !matrix.isDark(row, column)) {
            column += 1;
          }
          int runStart = column;
          while (column < matrix.size && matrix.isDark(row, column)) {
            column += 1;
          }
          if (runStart < column) {
            canvas.drawRect(
              left + runStart * moduleScale,
              top + row * moduleScale,
              left + column * moduleScale,
              top + (row + 1) * moduleScale,
              paint
            );
          }
        }
      }
    }

    private void stopMuxer() {
      if (muxer != null && muxerStarted && !muxerStopped) {
        muxer.stop();
        muxerStopped = true;
      }
    }

    private void release() {
      if (textureRenderer != null) {
        textureRenderer.release();
        textureRenderer = null;
      }
      if (eglInputSurface != null) {
        eglInputSurface.release();
        eglInputSurface = null;
      }
      if (codecInputSurface != null) {
        codecInputSurface.release();
        codecInputSurface = null;
      }
      if (codec != null) {
        try {
          codec.stop();
        } catch (Exception ignored) {
          // The codec may not have reached its started state.
        }
        codec.release();
        codec = null;
      }
      if (muxer != null) {
        if (muxerStarted && !muxerStopped) {
          try {
            muxer.stop();
          } catch (Exception ignored) {
            // A cancelled encoder may not have written a complete track.
          }
        }
        muxer.release();
        muxer = null;
      }
    }
  }

  private static final class EGLInputSurface {
    private static final int EGL_RECORDABLE_ANDROID = 0x3142;
    private EGLDisplay display = EGL14.EGL_NO_DISPLAY;
    private EGLContext context = EGL14.EGL_NO_CONTEXT;
    private EGLSurface surface = EGL14.EGL_NO_SURFACE;

    EGLInputSurface(Surface codecSurface) {
      display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY);
      if (display == EGL14.EGL_NO_DISPLAY) {
        throw new IllegalStateException("Unable to get an EGL display");
      }
      int[] versions = new int[2];
      if (!EGL14.eglInitialize(display, versions, 0, versions, 1)) {
        throw new IllegalStateException("Unable to initialize EGL");
      }
      int[] configAttributes = {
        EGL14.EGL_RED_SIZE, 8,
        EGL14.EGL_GREEN_SIZE, 8,
        EGL14.EGL_BLUE_SIZE, 8,
        EGL14.EGL_ALPHA_SIZE, 8,
        EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
        EGL_RECORDABLE_ANDROID, 1,
        EGL14.EGL_NONE,
      };
      EGLConfig[] configs = new EGLConfig[1];
      int[] configCount = new int[1];
      if (
        !EGL14.eglChooseConfig(
          display,
          configAttributes,
          0,
          configs,
          0,
          configs.length,
          configCount,
          0
        ) || configCount[0] <= 0
      ) {
        throw new IllegalStateException("Unable to choose an EGL config");
      }
      int[] contextAttributes = {
        EGL14.EGL_CONTEXT_CLIENT_VERSION, 2,
        EGL14.EGL_NONE,
      };
      context = EGL14.eglCreateContext(
        display,
        configs[0],
        EGL14.EGL_NO_CONTEXT,
        contextAttributes,
        0
      );
      checkEglError("eglCreateContext");
      int[] surfaceAttributes = {EGL14.EGL_NONE};
      surface = EGL14.eglCreateWindowSurface(
        display,
        configs[0],
        codecSurface,
        surfaceAttributes,
        0
      );
      checkEglError("eglCreateWindowSurface");
    }

    void makeCurrent() {
      if (!EGL14.eglMakeCurrent(display, surface, surface, context)) {
        throw new IllegalStateException("Unable to make the EGL context current");
      }
    }

    void setPresentationTime(long nanoseconds) {
      EGLExt.eglPresentationTimeANDROID(display, surface, nanoseconds);
    }

    boolean swapBuffers() {
      return EGL14.eglSwapBuffers(display, surface);
    }

    void release() {
      if (display != EGL14.EGL_NO_DISPLAY) {
        EGL14.eglMakeCurrent(
          display,
          EGL14.EGL_NO_SURFACE,
          EGL14.EGL_NO_SURFACE,
          EGL14.EGL_NO_CONTEXT
        );
        if (surface != EGL14.EGL_NO_SURFACE) {
          EGL14.eglDestroySurface(display, surface);
        }
        if (context != EGL14.EGL_NO_CONTEXT) {
          EGL14.eglDestroyContext(display, context);
        }
        EGL14.eglReleaseThread();
        EGL14.eglTerminate(display);
      }
      display = EGL14.EGL_NO_DISPLAY;
      context = EGL14.EGL_NO_CONTEXT;
      surface = EGL14.EGL_NO_SURFACE;
    }

    private static void checkEglError(String operation) {
      int error = EGL14.eglGetError();
      if (error != EGL14.EGL_SUCCESS) {
        throw new IllegalStateException(
          operation + " failed with EGL error 0x" + Integer.toHexString(error)
        );
      }
    }
  }

  private static final class QRTextureRenderer {
    private static final float[] VERTICES = {
      -1.0f, -1.0f, 0.0f, 1.0f,
       1.0f, -1.0f, 1.0f, 1.0f,
      -1.0f,  1.0f, 0.0f, 0.0f,
       1.0f,  1.0f, 1.0f, 0.0f,
    };
    private static final String VERTEX_SHADER =
      "attribute vec2 aPosition;\n" +
      "attribute vec2 aTexCoord;\n" +
      "varying vec2 vTexCoord;\n" +
      "void main() {\n" +
      "  gl_Position = vec4(aPosition, 0.0, 1.0);\n" +
      "  vTexCoord = aTexCoord;\n" +
      "}\n";
    private static final String FRAGMENT_SHADER =
      "precision mediump float;\n" +
      "uniform sampler2D uTexture;\n" +
      "varying vec2 vTexCoord;\n" +
      "void main() {\n" +
      "  gl_FragColor = texture2D(uTexture, vTexCoord);\n" +
      "}\n";

    private final int width;
    private final int height;
    private final FloatBuffer vertexBuffer;
    private final int program;
    private final int positionHandle;
    private final int textureCoordinateHandle;
    private final int textureUniformHandle;
    private final int textureId;

    QRTextureRenderer(int width, int height) {
      this.width = width;
      this.height = height;
      vertexBuffer = ByteBuffer
        .allocateDirect(VERTICES.length * 4)
        .order(ByteOrder.nativeOrder())
        .asFloatBuffer();
      vertexBuffer.put(VERTICES).position(0);
      program = createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
      positionHandle = GLES20.glGetAttribLocation(program, "aPosition");
      textureCoordinateHandle = GLES20.glGetAttribLocation(program, "aTexCoord");
      textureUniformHandle = GLES20.glGetUniformLocation(program, "uTexture");
      int[] textures = new int[1];
      GLES20.glGenTextures(1, textures, 0);
      textureId = textures[0];
      GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId);
      GLES20.glTexParameteri(
        GLES20.GL_TEXTURE_2D,
        GLES20.GL_TEXTURE_MIN_FILTER,
        GLES20.GL_NEAREST
      );
      GLES20.glTexParameteri(
        GLES20.GL_TEXTURE_2D,
        GLES20.GL_TEXTURE_MAG_FILTER,
        GLES20.GL_NEAREST
      );
      GLES20.glTexParameteri(
        GLES20.GL_TEXTURE_2D,
        GLES20.GL_TEXTURE_WRAP_S,
        GLES20.GL_CLAMP_TO_EDGE
      );
      GLES20.glTexParameteri(
        GLES20.GL_TEXTURE_2D,
        GLES20.GL_TEXTURE_WRAP_T,
        GLES20.GL_CLAMP_TO_EDGE
      );
    }

    void upload(Bitmap bitmap) {
      GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId);
      GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0);
    }

    void draw() {
      GLES20.glViewport(0, 0, width, height);
      GLES20.glClearColor(1f, 1f, 1f, 1f);
      GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);
      GLES20.glUseProgram(program);
      vertexBuffer.position(0);
      GLES20.glEnableVertexAttribArray(positionHandle);
      GLES20.glVertexAttribPointer(
        positionHandle,
        2,
        GLES20.GL_FLOAT,
        false,
        4 * 4,
        vertexBuffer
      );
      vertexBuffer.position(2);
      GLES20.glEnableVertexAttribArray(textureCoordinateHandle);
      GLES20.glVertexAttribPointer(
        textureCoordinateHandle,
        2,
        GLES20.GL_FLOAT,
        false,
        4 * 4,
        vertexBuffer
      );
      GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
      GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId);
      GLES20.glUniform1i(textureUniformHandle, 0);
      GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
      GLES20.glDisableVertexAttribArray(positionHandle);
      GLES20.glDisableVertexAttribArray(textureCoordinateHandle);
    }

    void release() {
      int[] textures = {textureId};
      GLES20.glDeleteTextures(1, textures, 0);
      GLES20.glDeleteProgram(program);
    }

    private static int createProgram(String vertexSource, String fragmentSource) {
      int vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, vertexSource);
      int fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, fragmentSource);
      int program = GLES20.glCreateProgram();
      GLES20.glAttachShader(program, vertexShader);
      GLES20.glAttachShader(program, fragmentShader);
      GLES20.glLinkProgram(program);
      int[] status = new int[1];
      GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, status, 0);
      GLES20.glDeleteShader(vertexShader);
      GLES20.glDeleteShader(fragmentShader);
      if (status[0] == 0) {
        String log = GLES20.glGetProgramInfoLog(program);
        GLES20.glDeleteProgram(program);
        throw new IllegalStateException("Unable to link QR video shader: " + log);
      }
      return program;
    }

    private static int compileShader(int type, String source) {
      int shader = GLES20.glCreateShader(type);
      GLES20.glShaderSource(shader, source);
      GLES20.glCompileShader(shader);
      int[] status = new int[1];
      GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0);
      if (status[0] == 0) {
        String log = GLES20.glGetShaderInfoLog(shader);
        GLES20.glDeleteShader(shader);
        throw new IllegalStateException("Unable to compile QR video shader: " + log);
      }
      return shader;
    }
  }
}
