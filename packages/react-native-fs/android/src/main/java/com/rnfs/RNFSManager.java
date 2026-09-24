package com.rnfs;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Environment;
import android.os.StatFs;
import android.provider.MediaStore;
import android.util.Log;
import android.util.Base64;
import android.util.SparseArray;
import android.media.MediaScannerConnection;

import androidx.annotation.NonNull;

import com.facebook.jni.HybridData;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.JavaScriptContextHolder;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.RCTNativeAppEventEmitter;
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl;
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

@ReactModule(name = RNFSManager.MODULE_NAME)
public class RNFSManager extends ReactContextBaseJavaModule {

  static final String MODULE_NAME = "RNFSManager";

  private static final String RNFSDocumentDirectoryPath = "RNFSDocumentDirectoryPath";
  private static final String RNFSExternalDirectoryPath = "RNFSExternalDirectoryPath";
  private static final String RNFSExternalStorageDirectoryPath = "RNFSExternalStorageDirectoryPath";
  private static final String RNFSPicturesDirectoryPath = "RNFSPicturesDirectoryPath";
  private static final String RNFSDownloadDirectoryPath = "RNFSDownloadDirectoryPath";
  private static final String RNFSTemporaryDirectoryPath = "RNFSTemporaryDirectoryPath";
  private static final String RNFSCachesDirectoryPath = "RNFSCachesDirectoryPath";
  private static final String RNFSExternalCachesDirectoryPath = "RNFSExternalCachesDirectoryPath";
  private static final String RNFSDocumentDirectory = "RNFSDocumentDirectory";

  private static final String RNFSFileTypeRegular = "RNFSFileTypeRegular";
  private static final String RNFSFileTypeDirectory = "RNFSFileTypeDirectory";
  private static final int RNFSPathTailMaxLength = 96;

  private SparseArray<Downloader> downloaders = new SparseArray<>();
  private SparseArray<Uploader> uploaders = new SparseArray<>();

  private ReactApplicationContext reactContext;

  @DoNotStrip
  private HybridData mHybridData;

  private native HybridData initHybrid();

  private native void nativeInstall(
      long jsiPtr,
      CallInvokerHolderImpl jsCallInvokerHolder,
      String cacheDirectory);

  private native void nativeCompleteSafeMediaDownload(
      long requestId,
      int code,
      int httpStatus,
      long bytesWritten);

  @DoNotStrip
  private void startSafeMediaDownload(
      long requestId,
      String url,
      String destination,
      long maxBytes,
      int timeoutMs) {
    SafeSvgDownloader.download(
        url,
        destination,
        maxBytes,
        timeoutMs,
        (code, httpStatus, bytesWritten) ->
            nativeCompleteSafeMediaDownload(
                requestId, code, httpStatus, bytesWritten));
  }

  private static String pathTail(String path) {
    if (path == null || path.length() <= RNFSPathTailMaxLength) {
      return path;
    }
    return "..." + path.substring(path.length() - RNFSPathTailMaxLength);
  }

  public RNFSManager(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @NonNull
  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  public boolean install() {
    try {
      if (mHybridData != null) {
        return true;
      }

      System.loadLibrary("rabbynativefs");
      JavaScriptContextHolder jsContext = getReactApplicationContext().getJavaScriptContextHolder();
      CallInvokerHolder jsCallInvokerHolder = getReactApplicationContext().getJSCallInvokerHolder();
      if (jsContext == null || jsContext.get() == 0) {
        return false;
      }
      mHybridData = initHybrid();
      nativeInstall(
          jsContext.get(),
          jsCallInvokerHolder instanceof CallInvokerHolderImpl
              ? (CallInvokerHolderImpl) jsCallInvokerHolder
              : null,
          getReactApplicationContext().getCacheDir().getAbsolutePath());
      return true;
    } catch (Exception exception) {
      if (mHybridData != null) {
        mHybridData.resetNative();
        mHybridData = null;
      }
      Log.e(MODULE_NAME, "Failed to install RabbyNativeFS JSI bindings", exception);
      return false;
    }
  }

  @Override
  public void invalidate() {
    if (mHybridData != null) {
      mHybridData.resetNative();
      mHybridData = null;
    }
    super.invalidate();
  }

  private Uri getFileUri(String filepath, boolean isDirectoryAllowed) throws IORejectionException {
    Uri uri = Uri.parse(filepath);
    if (uri.getScheme() == null) {
      // No prefix, assuming that provided path is absolute path to file
      File file = new File(filepath);
      if (!isDirectoryAllowed && file.isDirectory()) {
        throw new IORejectionException("EISDIR", "EISDIR: illegal operation on a directory, read '" + filepath + "'");
      }
      uri = Uri.parse("file://" + filepath);
    }
    return uri;
  }

  private String getOriginalFilepath(String filepath, boolean isDirectoryAllowed) throws IORejectionException {
    Uri uri = getFileUri(filepath, isDirectoryAllowed);
    String originalFilepath = filepath;
    if (uri.getScheme().equals("content")) {
      try {
        Cursor cursor = reactContext.getContentResolver().query(uri, null, null, null, null);
        if (cursor.moveToFirst()) {
          originalFilepath = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA));
        }
        cursor.close();
      } catch (IllegalArgumentException ignored) {
      }
    }
    return originalFilepath;
  }

  private InputStream getInputStream(String filepath) throws IORejectionException {
    Uri uri = getFileUri(filepath, false);
    InputStream stream;
    try {
      stream = reactContext.getContentResolver().openInputStream(uri);
    } catch (FileNotFoundException ex) {
      throw new IORejectionException("ENOENT", "ENOENT: " + ex.getMessage() + ", open '" + filepath + "'");
    }
    if (stream == null) {
      throw new IORejectionException("ENOENT", "ENOENT: could not open an input stream for '" + filepath + "'");
    }
    return stream;
  }

  private String getWriteAccessByAPILevel() {
    return android.os.Build.VERSION.SDK_INT <= android.os.Build.VERSION_CODES.P ? "w" : "rwt";
  }

  private OutputStream getOutputStream(String filepath, boolean append) throws IORejectionException {
    Uri uri = getFileUri(filepath, false);
    OutputStream stream;
    try {
      stream = reactContext.getContentResolver().openOutputStream(uri, append ? "wa" : getWriteAccessByAPILevel());
    } catch (FileNotFoundException ex) {
      throw new IORejectionException("ENOENT", "ENOENT: " + ex.getMessage() + ", open '" + filepath + "'");
    }
    if (stream == null) {
      throw new IORejectionException("ENOENT", "ENOENT: could not open an output stream for '" + filepath + "'");
    }
    return stream;
  }

  private static byte[] getInputStreamBytes(InputStream inputStream) throws IOException {
    byte[] bytesResult;
    ByteArrayOutputStream byteBuffer = new ByteArrayOutputStream();
    int bufferSize = 1024;
    byte[] buffer = new byte[bufferSize];
    try {
      int len;
      while ((len = inputStream.read(buffer)) != -1) {
        byteBuffer.write(buffer, 0, len);
      }
      bytesResult = byteBuffer.toByteArray();
    } finally {
      try {
        byteBuffer.close();
      } catch (IOException ignored) {
      }
    }
    return bytesResult;
  }

  @ReactMethod
  public void writeFile(String filepath, String base64Content, ReadableMap options, Promise promise) {
    try {
      byte[] bytes = Base64.decode(base64Content, Base64.DEFAULT);

      OutputStream outputStream = getOutputStream(filepath, false);
      outputStream.write(bytes);
      outputStream.close();

      promise.resolve(null);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void appendFile(String filepath, String base64Content, Promise promise) {
    try {
      byte[] bytes = Base64.decode(base64Content, Base64.DEFAULT);

      OutputStream outputStream = getOutputStream(filepath, true);
      outputStream.write(bytes);
      outputStream.close();

      promise.resolve(null);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void write(String filepath, String base64Content, int position, Promise promise) {
    try {
      byte[] bytes = Base64.decode(base64Content, Base64.DEFAULT);

      if (position < 0) {
        OutputStream outputStream = getOutputStream(filepath, true);
        outputStream.write(bytes);
        outputStream.close();
      } else {
        RandomAccessFile file = new RandomAccessFile(filepath, "rw");
        file.seek(position);
        file.write(bytes);
        file.close();
      }

      promise.resolve(null);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void exists(String filepath, Promise promise) {
    try {
      File file = new File(filepath);
      promise.resolve(file.exists());
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void readFile(String filepath, Promise promise) {
    try {
      InputStream inputStream = getInputStream(filepath);
      byte[] inputData = getInputStreamBytes(inputStream);
      String base64Content = Base64.encodeToString(inputData, Base64.NO_WRAP);

      promise.resolve(base64Content);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void read(String filepath, int length, int position, Promise promise) {
    try {
      InputStream inputStream = getInputStream(filepath);
      byte[] buffer = new byte[length];
      inputStream.skip(position);
      int bytesRead = inputStream.read(buffer, 0, length);

      String base64Content = Base64.encodeToString(buffer, 0, bytesRead, Base64.NO_WRAP);

      promise.resolve(base64Content);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void readFileAssets(String filepath, Promise promise) {
    InputStream stream = null;
    try {
      // ensure isn't a directory
      AssetManager assetManager = getReactApplicationContext().getAssets();
      stream = assetManager.open(filepath, 0);
      if (stream == null) {
        reject(promise, filepath, new Exception("Failed to open file"));
        return;
      }

      byte[] buffer = new byte[stream.available()];
      stream.read(buffer);
      String base64Content = Base64.encodeToString(buffer, Base64.NO_WRAP);
      promise.resolve(base64Content);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    } finally {
      if (stream != null) {
        try {
          stream.close();
        } catch (IOException ignored) {
        }
      }
    }
  }

  @ReactMethod
  public void readFileRes(String filename, Promise promise) {
    InputStream stream = null;
    try {
      int res = getResIdentifier(filename);
      stream = getReactApplicationContext().getResources().openRawResource(res);
      if (stream == null) {
        reject(promise, filename, new Exception("Failed to open file"));
        return;
      }

      byte[] buffer = new byte[stream.available()];
      stream.read(buffer);
      String base64Content = Base64.encodeToString(buffer, Base64.NO_WRAP);
      promise.resolve(base64Content);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filename, ex);
    } finally {
      if (stream != null) {
        try {
          stream.close();
        } catch (IOException ignored) {
        }
      }
    }
  }

  private int getResIdentifier(String filename) {
    String suffix = filename.substring(filename.lastIndexOf(".") + 1);
    String name = filename.substring(0, filename.lastIndexOf("."));
    Boolean isImage = suffix.equals("png") || suffix.equals("jpg") || suffix.equals("jpeg") || suffix.equals("bmp") || suffix.equals("gif") || suffix.equals("webp") || suffix.equals("psd") || suffix.equals("svg") || suffix.equals("tiff");
    return getReactApplicationContext().getResources().getIdentifier(name, isImage ? "drawable" : "raw", getReactApplicationContext().getPackageName());
  }

  @ReactMethod
  public void hash(String filepath, String algorithm, Promise promise) {
    try {
      Map<String, String> algorithms = new HashMap<>();

      algorithms.put("md5", "MD5");
      algorithms.put("sha1", "SHA-1");
      algorithms.put("sha224", "SHA-224");
      algorithms.put("sha256", "SHA-256");
      algorithms.put("sha384", "SHA-384");
      algorithms.put("sha512", "SHA-512");

      if (!algorithms.containsKey(algorithm)) throw new Exception("Invalid hash algorithm");

      File file = new File(filepath);

      if (file.isDirectory()) {
        rejectFileIsDirectory(promise);
        return;
      }

      if (!file.exists()) {
        rejectFileNotFound(promise, filepath);
        return;
      }

      MessageDigest md = MessageDigest.getInstance(algorithms.get(algorithm));

      FileInputStream inputStream = new FileInputStream(filepath);
      byte[] buffer = new byte[1024 * 10]; // 10 KB Buffer

      int read;
      while ((read = inputStream.read(buffer)) != -1) {
        md.update(buffer, 0, read);
      }

      StringBuilder hexString = new StringBuilder();
      for (byte digestByte : md.digest())
        hexString.append(String.format("%02x", digestByte));

      promise.resolve(hexString.toString());
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void moveFile(final String filepath, String destPath, ReadableMap options, final Promise promise) {
    try {
      final File inFile = new File(filepath);

      if (!inFile.renameTo(new File(destPath))) {
        new CopyFileTask() {
          @Override
          protected void onPostExecute (Exception ex) {
            if (ex == null) {
              inFile.delete();
              promise.resolve(true);
            } else {
              ex.printStackTrace();
              reject(promise, filepath, ex);
            }
          }
        }.execute(filepath, destPath);
      } else {
          promise.resolve(true);
      }
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void copyFile(final String filepath, final String destPath, ReadableMap options, final Promise promise) {
    new CopyFileTask() {
      @Override
      protected void onPostExecute (Exception ex) {
        if (ex == null) {
          promise.resolve(null);
        } else {
          ex.printStackTrace();
          reject(promise, filepath, ex);
        }
      }
    }.execute(filepath, destPath);
  }

  @ReactMethod
  public void persistFile(final String sourceUri, final String targetPath, final ReadableMap options, final Promise promise) {
    new PersistFileTask(promise).execute(sourceUri, targetPath, options);
  }

  @ReactMethod
  public void createZipArchive(final String targetPath, final ReadableArray entries, final ReadableMap options, final Promise promise) {
    new CreateZipArchiveTask(promise).execute(targetPath, entries, options);
  }

  @ReactMethod
  public void extractZipEntry(final String archivePath, final String targetPath, final ReadableMap options, final Promise promise) {
    new ExtractZipEntryTask(promise).execute(archivePath, targetPath, options);
  }

  @ReactMethod
  public void listZipEntries(final String archivePath, final ReadableMap options, final Promise promise) {
    new ListZipEntriesTask(promise).execute(archivePath, options);
  }

  private static String normalizeZipEntryName(String entryName) throws IOException {
    if (entryName == null) {
      throw new IOException("Zip entry path is required");
    }

    String normalized = entryName.replace('\\', '/');
    while (normalized.startsWith("/")) {
      normalized = normalized.substring(1);
    }

    ArrayList<String> parts = new ArrayList<>();
    for (String part : normalized.split("/")) {
      if (part.length() == 0 || part.equals(".")) {
        continue;
      }
      if (part.equals("..")) {
        throw new IOException("Zip entry path must not contain '..': " + entryName);
      }
      parts.add(part);
    }

    if (parts.isEmpty()) {
      throw new IOException("Zip entry path is empty");
    }

    return String.join("/", parts);
  }

  private static int normalizeCompressionLevel(ReadableMap options) {
    if (options == null || !options.hasKey("compressionLevel")) {
      return Deflater.DEFAULT_COMPRESSION;
    }

    int level = options.getInt("compressionLevel");
    if (level < Deflater.NO_COMPRESSION) {
      return Deflater.NO_COMPRESSION;
    }
    if (level > Deflater.BEST_COMPRESSION) {
      return Deflater.BEST_COMPRESSION;
    }
    return level;
  }

  private static String getOptionalString(ReadableMap options, String key) {
    if (options == null || !options.hasKey(key) || options.isNull(key)) {
      return null;
    }
    return options.getString(key);
  }

  private static class ZipArchiveResult {
    String targetPath;
    int entryCount;
    long bytesRead;
    long bytesWritten;
    long durationMs;
    Exception exception;
  }

  private static class ZipEntryExtractionResult {
    String archivePath;
    String targetPath;
    String entryName;
    long bytesWritten;
    long durationMs;
    Exception exception;
  }

  private static class ZipEntryListingResult {
    String archivePath;
    WritableArray entries;
    int entryCount;
    long totalBytes;
    long durationMs;
    Exception exception;
  }

  private class CreateZipArchiveTask extends AsyncTask<Object, Void, ZipArchiveResult> {
    private final Promise promise;

    CreateZipArchiveTask(Promise promise) {
      this.promise = promise;
    }

    @Override
    protected ZipArchiveResult doInBackground(Object... args) {
      ZipArchiveResult result = new ZipArchiveResult();
      long startedAt = System.nanoTime();
      String targetPath = (String) args[0];
      ReadableArray entries = (ReadableArray) args[1];
      ReadableMap options = (ReadableMap) args[2];
      File targetFile = new File(targetPath);
      result.targetPath = targetPath;

      try {
        File parent = targetFile.getParentFile();
        if (parent != null) {
          parent.mkdirs();
        }

        byte[] buffer = new byte[256 * 1024];
        try (FileOutputStream outputStream = new FileOutputStream(targetFile, false);
             ZipOutputStream zipOutputStream = new ZipOutputStream(outputStream)) {
          zipOutputStream.setLevel(normalizeCompressionLevel(options));

          for (int index = 0; index < entries.size(); index += 1) {
            ReadableMap entry = entries.getMap(index);
            String sourcePath = entry.getString("sourcePath");
            String archivePath = normalizeZipEntryName(entry.getString("archivePath"));
            File sourceFile = new File(sourcePath);
            if (!sourceFile.isFile()) {
              throw new IOException("Zip source file does not exist: " + sourcePath);
            }

            ZipEntry zipEntry = new ZipEntry(archivePath);
            if (entry.hasKey("mtimeMs")) {
              zipEntry.setTime((long) entry.getDouble("mtimeMs"));
            } else {
              zipEntry.setTime(sourceFile.lastModified());
            }
            zipOutputStream.putNextEntry(zipEntry);

            try (BufferedInputStream inputStream = new BufferedInputStream(new FileInputStream(sourceFile), buffer.length)) {
              int read;
              while ((read = inputStream.read(buffer)) != -1) {
                zipOutputStream.write(buffer, 0, read);
                result.bytesRead += read;
              }
            }

            zipOutputStream.closeEntry();
            result.entryCount += 1;
            Thread.yield();
          }
        }

        result.bytesWritten = targetFile.length();
      } catch (Exception ex) {
        targetFile.delete();
        result.exception = ex;
      } finally {
        result.durationMs = (System.nanoTime() - startedAt) / 1000000;
      }

      return result;
    }

    @Override
    protected void onPostExecute(ZipArchiveResult result) {
      if (result.exception != null) {
        result.exception.printStackTrace();
        reject(promise, result.targetPath, result.exception);
        return;
      }

      Log.i(
          "RabbyNativeFS",
          String.format(
              Locale.US,
              "[zip] op=createZipArchive entries=%d bytes_read=%d bytes_written=%d duration_ms=%d path_tail=%s",
              result.entryCount,
              result.bytesRead,
              result.bytesWritten,
              result.durationMs,
              pathTail(result.targetPath)));

      WritableMap infoMap = Arguments.createMap();
      infoMap.putString("targetPath", result.targetPath);
      infoMap.putInt("entries", result.entryCount);
      infoMap.putDouble("bytesRead", (double) result.bytesRead);
      infoMap.putDouble("bytesWritten", (double) result.bytesWritten);
      infoMap.putDouble("durationMs", (double) result.durationMs);
      promise.resolve(infoMap);
    }
  }

  private class ExtractZipEntryTask extends AsyncTask<Object, Void, ZipEntryExtractionResult> {
    private final Promise promise;

    ExtractZipEntryTask(Promise promise) {
      this.promise = promise;
    }

    @Override
    protected ZipEntryExtractionResult doInBackground(Object... args) {
      ZipEntryExtractionResult result = new ZipEntryExtractionResult();
      long startedAt = System.nanoTime();
      String archivePath = (String) args[0];
      String targetPath = (String) args[1];
      ReadableMap options = (ReadableMap) args[2];
      File archiveFile = new File(archivePath);
      File targetFile = new File(targetPath);
      result.archivePath = archivePath;
      result.targetPath = targetPath;

      try {
        if (!archiveFile.isFile()) {
          throw new IOException("Zip archive file does not exist: " + archivePath);
        }

        File parent = targetFile.getParentFile();
        if (parent != null) {
          parent.mkdirs();
        }

        String requestedEntryName = getOptionalString(options, "entryName");
        if (requestedEntryName != null && requestedEntryName.length() > 0) {
          requestedEntryName = normalizeZipEntryName(requestedEntryName);
        } else {
          requestedEntryName = null;
        }
        String entryNameSuffix = getOptionalString(options, "entryNameSuffix");

        byte[] buffer = new byte[256 * 1024];
        try (ZipFile zipFile = new ZipFile(archiveFile)) {
          ZipEntry selectedEntry = null;
          String selectedEntryName = null;

          if (requestedEntryName != null) {
            ZipEntry entry = zipFile.getEntry(requestedEntryName);
            if (entry != null && !entry.isDirectory()) {
              selectedEntry = entry;
              selectedEntryName = requestedEntryName;
            }
          } else {
            Enumeration<? extends ZipEntry> zipEntries = zipFile.entries();
            while (zipEntries.hasMoreElements()) {
              ZipEntry entry = zipEntries.nextElement();
              if (entry.isDirectory()) {
                continue;
              }

              String entryName;
              try {
                entryName = normalizeZipEntryName(entry.getName());
              } catch (IOException ignored) {
                continue;
              }

              if (entryNameSuffix != null && !entryName.endsWith(entryNameSuffix)) {
                continue;
              }

              if (selectedEntryName == null || entryName.compareTo(selectedEntryName) > 0) {
                selectedEntry = entry;
                selectedEntryName = entryName;
              }
            }
          }

          if (selectedEntry == null || selectedEntryName == null) {
            throw new IOException("Zip entry not found in " + archivePath);
          }

          try (BufferedInputStream inputStream = new BufferedInputStream(zipFile.getInputStream(selectedEntry), buffer.length);
               FileOutputStream outputStream = new FileOutputStream(targetFile, false)) {
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
              outputStream.write(buffer, 0, read);
              result.bytesWritten += read;
            }
          }

          if (selectedEntry.getTime() > 0) {
            targetFile.setLastModified(selectedEntry.getTime());
          }
          result.entryName = selectedEntryName;
        }
      } catch (Exception ex) {
        targetFile.delete();
        result.exception = ex;
      } finally {
        result.durationMs = (System.nanoTime() - startedAt) / 1000000;
      }

      return result;
    }

    @Override
    protected void onPostExecute(ZipEntryExtractionResult result) {
      if (result.exception != null) {
        result.exception.printStackTrace();
        reject(promise, result.archivePath, result.exception);
        return;
      }

      Log.i(
          "RabbyNativeFS",
          String.format(
              Locale.US,
              "[zip] op=extractZipEntry entry=%s bytes_written=%d duration_ms=%d target_tail=%s",
              result.entryName,
              result.bytesWritten,
              result.durationMs,
              pathTail(result.targetPath)));

      WritableMap infoMap = Arguments.createMap();
      infoMap.putString("archivePath", result.archivePath);
      infoMap.putString("targetPath", result.targetPath);
      infoMap.putString("entryName", result.entryName);
      infoMap.putDouble("bytesWritten", (double) result.bytesWritten);
      infoMap.putDouble("durationMs", (double) result.durationMs);
      promise.resolve(infoMap);
    }
  }

  private class ListZipEntriesTask extends AsyncTask<Object, Void, ZipEntryListingResult> {
    private final Promise promise;

    ListZipEntriesTask(Promise promise) {
      this.promise = promise;
    }

    @Override
    protected ZipEntryListingResult doInBackground(Object... args) {
      ZipEntryListingResult result = new ZipEntryListingResult();
      long startedAt = System.nanoTime();
      String archivePath = (String) args[0];
      ReadableMap options = (ReadableMap) args[1];
      File archiveFile = new File(archivePath);
      result.archivePath = archivePath;
      result.entries = Arguments.createArray();

      try {
        if (!archiveFile.isFile()) {
          throw new IOException("Zip archive file does not exist: " + archivePath);
        }

        boolean includeDirectories =
            options != null &&
            options.hasKey("includeDirectories") &&
            !options.isNull("includeDirectories") &&
            options.getBoolean("includeDirectories");
        int limit =
            options != null && options.hasKey("limit") && !options.isNull("limit")
                ? options.getInt("limit")
                : 0;
        String entryNameSuffix = getOptionalString(options, "entryNameSuffix");

        try (ZipFile zipFile = new ZipFile(archiveFile)) {
          Enumeration<? extends ZipEntry> zipEntries = zipFile.entries();
          while (zipEntries.hasMoreElements()) {
            ZipEntry entry = zipEntries.nextElement();
            boolean isDirectory = entry.isDirectory();
            if (isDirectory && !includeDirectories) {
              continue;
            }

            String entryName;
            try {
              entryName = normalizeZipEntryName(entry.getName());
            } catch (IOException ignored) {
              continue;
            }

            if (entryNameSuffix != null && !entryName.endsWith(entryNameSuffix)) {
              continue;
            }

            long uncompressedSize = Math.max(entry.getSize(), 0);
            long compressedSize = Math.max(entry.getCompressedSize(), 0);
            WritableMap entryMap = Arguments.createMap();
            entryMap.putString("entryName", entryName);
            entryMap.putBoolean("directory", isDirectory);
            entryMap.putDouble("compressedSize", (double) compressedSize);
            entryMap.putDouble("uncompressedSize", (double) uncompressedSize);
            entryMap.putDouble("crc32", (double) Math.max(entry.getCrc(), 0));
            entryMap.putInt("method", entry.getMethod());
            if (entry.getTime() > 0) {
              entryMap.putDouble("mtimeMs", (double) entry.getTime());
            }

            result.entries.pushMap(entryMap);
            result.entryCount += 1;
            result.totalBytes += uncompressedSize;

            if (limit > 0 && result.entryCount >= limit) {
              break;
            }
          }
        }
      } catch (Exception ex) {
        result.exception = ex;
      } finally {
        result.durationMs = (System.nanoTime() - startedAt) / 1000000;
      }

      return result;
    }

    @Override
    protected void onPostExecute(ZipEntryListingResult result) {
      if (result.exception != null) {
        result.exception.printStackTrace();
        reject(promise, result.archivePath, result.exception);
        return;
      }

      Log.i(
          "RabbyNativeFS",
          String.format(
              Locale.US,
              "[zip] op=listZipEntries entries=%d bytes=%d duration_ms=%d path_tail=%s",
              result.entryCount,
              result.totalBytes,
              result.durationMs,
              pathTail(result.archivePath)));

      WritableMap infoMap = Arguments.createMap();
      infoMap.putString("archivePath", result.archivePath);
      infoMap.putArray("entries", result.entries);
      infoMap.putInt("totalEntries", result.entryCount);
      infoMap.putDouble("totalBytes", (double) result.totalBytes);
      infoMap.putDouble("durationMs", (double) result.durationMs);
      promise.resolve(infoMap);
    }
  }

  private class CopyFileTask extends AsyncTask<String, Void, Exception> {
    protected Exception doInBackground(String... paths) {
      try {
        String filepath = paths[0];
        String destPath = paths[1];

        InputStream in = getInputStream(filepath);
        OutputStream out = getOutputStream(destPath, false);

        byte[] buffer = new byte[1024];
        int length;
        while ((length = in.read(buffer)) > 0) {
          out.write(buffer, 0, length);
          Thread.yield();
        }
        in.close();
        out.close();
        return null;
      } catch (Exception ex) {
        return ex;
      }
    }
  }

  private static class PersistFileResult {
    String sourcePath;
    String targetPath;
    String mode;
    long bytesWritten;
    long durationMs;
    Exception exception;
  }

  private boolean getBooleanOption(ReadableMap options, String key, boolean fallback) {
    if (options == null || !options.hasKey(key) || options.isNull(key)) {
      return fallback;
    }
    return options.getBoolean(key);
  }

  private String getStringOption(ReadableMap options, String key, String fallback) {
    if (options == null || !options.hasKey(key) || options.isNull(key)) {
      return fallback;
    }
    return options.getString(key);
  }

  private File getFileFromFileUri(String path, boolean isDirectoryAllowed) throws IORejectionException {
    Uri uri = getFileUri(path, isDirectoryAllowed);
    if (!"file".equals(uri.getScheme())) {
      return null;
    }
    return new File(uri.getPath());
  }

  private void ensureParentDirectoryForFilePath(String path) throws IORejectionException, IOException {
    File targetFile = getFileFromFileUri(path, false);
    if (targetFile == null) {
      return;
    }
    File parent = targetFile.getParentFile();
    if (parent != null && !parent.exists() && !parent.mkdirs() && !parent.exists()) {
      throw new IOException("Failed to create parent directory for '" + path + "'");
    }
  }

  private void deleteFileIfExists(String path) throws IORejectionException, IOException {
    File file = getFileFromFileUri(path, true);
    if (file != null && file.exists() && !file.delete()) {
      throw new IOException("Failed to delete existing file '" + path + "'");
    }
  }

  private long copyStreamToPath(String sourceUri, String targetPath) throws Exception {
    InputStream in = null;
    OutputStream out = null;
    long bytesWritten = 0;
    try {
      in = getInputStream(sourceUri);
      out = getOutputStream(targetPath, false);
      byte[] buffer = new byte[256 * 1024];
      int read;
      while ((read = in.read(buffer)) != -1) {
        out.write(buffer, 0, read);
        bytesWritten += read;
      }
      return bytesWritten;
    } finally {
      if (in != null) {
        try {
          in.close();
        } catch (IOException ignored) {
        }
      }
      if (out != null) {
        try {
          out.close();
        } catch (IOException ignored) {
        }
      }
    }
  }

  private class PersistFileTask extends AsyncTask<Object, Void, PersistFileResult> {
    private final Promise promise;

    PersistFileTask(Promise promise) {
      this.promise = promise;
    }

    @Override
    protected PersistFileResult doInBackground(Object... args) {
      PersistFileResult result = new PersistFileResult();
      long startedAt = System.nanoTime();
      String sourceUri = (String) args[0];
      String targetPath = (String) args[1];
      ReadableMap options = (ReadableMap) args[2];
      String mode = getStringOption(options, "mode", "copy");
      boolean overwrite = getBooleanOption(options, "overwrite", true);
      boolean ensureParent = getBooleanOption(options, "ensureParent", true);

      result.sourcePath = sourceUri;
      result.targetPath = targetPath;
      result.mode = mode;

      try {
        if (!"copy".equals(mode) && !"move".equals(mode)) {
          throw new IOException("persistFile mode must be 'copy' or 'move'");
        }

        if (ensureParent) {
          ensureParentDirectoryForFilePath(targetPath);
        }

        File targetFile = getFileFromFileUri(targetPath, true);
        if (targetFile != null && targetFile.exists()) {
          if (!overwrite) {
            throw new IOException("Target file already exists: " + targetPath);
          }
          deleteFileIfExists(targetPath);
        }

        File sourceFile = getFileFromFileUri(sourceUri, false);
        boolean movedByRename = false;
        if ("move".equals(mode) && sourceFile != null && targetFile != null) {
          movedByRename = sourceFile.renameTo(targetFile);
          if (movedByRename) {
            result.bytesWritten = targetFile.length();
          }
        }

        if (!movedByRename) {
          result.bytesWritten = copyStreamToPath(sourceUri, targetPath);
          if ("move".equals(mode) && sourceFile != null && sourceFile.exists() && !sourceFile.delete()) {
            throw new IOException("Failed to delete source file after move: " + sourceUri);
          }
        }
      } catch (Exception ex) {
        result.exception = ex;
      } finally {
        result.durationMs = (System.nanoTime() - startedAt) / 1000000;
      }

      return result;
    }

    @Override
    protected void onPostExecute(PersistFileResult result) {
      if (result.exception != null) {
        result.exception.printStackTrace();
        reject(promise, result.sourcePath, result.exception);
        return;
      }

      Log.i(
          "RabbyNativeFS",
          String.format(
              Locale.US,
              "[persist-file] mode=%s bytes=%d duration_ms=%d source_tail=%s target_tail=%s",
              result.mode,
              result.bytesWritten,
              result.durationMs,
              pathTail(result.sourcePath),
              pathTail(result.targetPath)));

      WritableMap infoMap = Arguments.createMap();
      infoMap.putString("sourcePath", result.sourcePath);
      infoMap.putString("targetPath", result.targetPath);
      infoMap.putString("mode", result.mode);
      infoMap.putDouble("bytesWritten", (double) result.bytesWritten);
      infoMap.putDouble("durationMs", (double) result.durationMs);
      promise.resolve(infoMap);
    }
  }

  @ReactMethod
  public void readDir(String directory, Promise promise) {
    try {
      File file = new File(directory);

      if (!file.exists()) throw new Exception("Folder does not exist");

      File[] files = file.listFiles();

      WritableArray fileMaps = Arguments.createArray();

      for (File childFile : files) {
        WritableMap fileMap = Arguments.createMap();

        fileMap.putDouble("mtime", (double) childFile.lastModified() / 1000);
        fileMap.putString("name", childFile.getName());
        fileMap.putString("path", childFile.getAbsolutePath());
        fileMap.putDouble("size", (double) childFile.length());
        fileMap.putInt("type", childFile.isDirectory() ? 1 : 0);

        fileMaps.pushMap(fileMap);
      }

      promise.resolve(fileMaps);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, directory, ex);
    }
  }

  @ReactMethod
  public void readDirAssets(String directory, Promise promise) {
    try {
      AssetManager assetManager = getReactApplicationContext().getAssets();
      String[] list = assetManager.list(directory);

      WritableArray fileMaps = Arguments.createArray();
      for (String childFile : list) {
        WritableMap fileMap = Arguments.createMap();

        fileMap.putString("name", childFile);
        String path = directory.isEmpty() ? childFile : String.format("%s/%s", directory, childFile); // don't allow / at the start when directory is ""
        fileMap.putString("path", path);
        int length = 0;
        boolean isDirectory = true;
        try {
          AssetFileDescriptor assetFileDescriptor = assetManager.openFd(path);
          if (assetFileDescriptor != null) {
            length = (int) assetFileDescriptor.getLength();
            assetFileDescriptor.close();
            isDirectory = false;
          }
        } catch (IOException ex) {
          //.. ah.. is a directory or a compressed file?
          isDirectory = !ex.getMessage().contains("compressed");
        }
        fileMap.putInt("size", length);
        fileMap.putInt("type", isDirectory ? 1 : 0); // if 0, probably a folder..

        fileMaps.pushMap(fileMap);
      }
      promise.resolve(fileMaps);

    } catch (IOException e) {
      reject(promise, directory, e);
    }
  }

  @ReactMethod
  public void copyFileAssets(String assetPath, String destination, Promise promise) {
    AssetManager assetManager = getReactApplicationContext().getAssets();
    try {
      InputStream in = assetManager.open(assetPath);
      copyInputStream(in, assetPath, destination, promise);
    } catch (IOException e) {
      // Default error message is just asset name, so make a more helpful error here.
      reject(promise, assetPath, new Exception(String.format("Asset '%s' could not be opened", assetPath)));
    }
  }

  @ReactMethod
  public void copyFileRes(String filename, String destination, Promise promise) {
    try {
      int res = getResIdentifier(filename);
      InputStream in = getReactApplicationContext().getResources().openRawResource(res);
      copyInputStream(in, filename, destination, promise);
    } catch (Exception e) {
      reject(promise, filename, new Exception(String.format("Res '%s' could not be opened", filename)));
    }
  }

  @ReactMethod
  public void existsAssets(String filepath, Promise promise) {
    try {
      AssetManager assetManager = getReactApplicationContext().getAssets();

      try {
        String[] list = assetManager.list(filepath);
        if (list != null && list.length > 0) {
          promise.resolve(true);
          return;
        }
      } catch (Exception ignored) {
        //.. probably not a directory then
      }

      // Attempt to open file (win = exists)
      InputStream fileStream = null;
      try {
        fileStream = assetManager.open(filepath);
        promise.resolve(true);
      } catch (Exception ex) {
        promise.resolve(false); // don't throw an error, resolve false
      } finally {
        if (fileStream != null) {
          try {
            fileStream.close();
          } catch (Exception ignored) {
          }
        }
      }
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void existsRes(String filename, Promise promise) {
    try {
      int res = getResIdentifier(filename);
      if (res > 0) {
        promise.resolve(true);
      } else {
        promise.resolve(false);
      }
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filename, ex);
    }
  }

  /**
   * Internal method for copying that works with any InputStream
   *
   * @param in          InputStream from assets or file
   * @param source      source path (only used for logging errors)
   * @param destination destination path
   * @param promise     React Callback
   */
  private void copyInputStream(InputStream in, String source, String destination, Promise promise) {
    OutputStream out = null;
    try {
      out = getOutputStream(destination, false);

      byte[] buffer = new byte[1024 * 10]; // 10k buffer
      int read;
      while ((read = in.read(buffer)) != -1) {
        out.write(buffer, 0, read);
      }

      // Success!
      promise.resolve(null);
    } catch (Exception ex) {
      reject(promise, source, new Exception(String.format("Failed to copy '%s' to %s (%s)", source, destination, ex.getLocalizedMessage())));
    } finally {
      if (in != null) {
        try {
          in.close();
        } catch (IOException ignored) {
        }
      }
      if (out != null) {
        try {
          out.close();
        } catch (IOException ignored) {
        }
      }
    }
  }

  @ReactMethod
  public void setReadable(String filepath, Boolean readable, Boolean ownerOnly, Promise promise) {
    try {
      File file = new File(filepath);

      if (!file.exists()) throw new Exception("File does not exist");

      file.setReadable(readable, ownerOnly);

      promise.resolve(true);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void stat(String filepath, Promise promise) {
    try {
      String originalFilepath = getOriginalFilepath(filepath, true);
      File file = new File(originalFilepath);

      if (!file.exists()) throw new Exception("File does not exist");

      WritableMap statMap = Arguments.createMap();
      statMap.putInt("ctime", (int) (file.lastModified() / 1000));
      statMap.putInt("mtime", (int) (file.lastModified() / 1000));
      statMap.putDouble("size", (double) file.length());
      statMap.putInt("type", file.isDirectory() ? 1 : 0);
      statMap.putString("originalFilepath", originalFilepath);

      promise.resolve(statMap);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void unlink(String filepath, Promise promise) {
    try {
      File file = new File(filepath);

      if (!file.exists()) throw new Exception("File does not exist");

      DeleteRecursive(file);

      promise.resolve(null);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  private void DeleteRecursive(File fileOrDirectory) {
    if (fileOrDirectory.isDirectory()) {
      for (File child : fileOrDirectory.listFiles()) {
        DeleteRecursive(child);
      }
    }

    fileOrDirectory.delete();
  }

  @ReactMethod
  public void mkdir(String filepath, ReadableMap options, Promise promise) {
    try {
      File file = new File(filepath);

      file.mkdirs();

      boolean exists = file.exists();

      if (!exists) throw new Exception("Directory could not be created");

      promise.resolve(null);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  private void sendEvent(ReactContext reactContext, String eventName, WritableMap params) {
    reactContext
            .getJSModule(RCTNativeAppEventEmitter.class)
            .emit(eventName, params);
  }

  @ReactMethod
  public void downloadFile(final ReadableMap options, final Promise promise) {
    try {
      File file = new File(options.getString("toFile"));
      URL url = new URL(options.getString("fromUrl"));
      final int jobId = options.getInt("jobId");
      ReadableMap headers = options.getMap("headers");
      int progressInterval = options.getInt("progressInterval");
      int progressDivider = options.getInt("progressDivider");
      int readTimeout = options.getInt("readTimeout");
      int connectionTimeout = options.getInt("connectionTimeout");
      boolean hasBeginCallback = options.getBoolean("hasBeginCallback");
      boolean hasProgressCallback = options.getBoolean("hasProgressCallback");

      DownloadParams params = new DownloadParams();

      params.src = url;
      params.dest = file;
      params.headers = headers;
      params.progressInterval = progressInterval;
      params.progressDivider = progressDivider;
      params.readTimeout = readTimeout;
      params.connectionTimeout = connectionTimeout;

      params.onTaskCompleted = new DownloadParams.OnTaskCompleted() {
        public void onTaskCompleted(DownloadResult res) {
          if (res.exception == null) {
            WritableMap infoMap = Arguments.createMap();

            infoMap.putInt("jobId", jobId);
            infoMap.putInt("statusCode", res.statusCode);
            infoMap.putDouble("bytesWritten", (double)res.bytesWritten);

            promise.resolve(infoMap);
          } else {
            reject(promise, options.getString("toFile"), res.exception);
          }
        }
      };

      if (hasBeginCallback) {
        params.onDownloadBegin = new DownloadParams.OnDownloadBegin() {
          public void onDownloadBegin(int statusCode, long contentLength, Map<String, String> headers) {
            WritableMap headersMap = Arguments.createMap();

            for (Map.Entry<String, String> entry : headers.entrySet()) {
              headersMap.putString(entry.getKey(), entry.getValue());
            }

            WritableMap data = Arguments.createMap();

            data.putInt("jobId", jobId);
            data.putInt("statusCode", statusCode);
            data.putDouble("contentLength", (double)contentLength);
            data.putMap("headers", headersMap);

            sendEvent(getReactApplicationContext(), "DownloadBegin", data);
          }
        };
      }

      if (hasProgressCallback) {
        params.onDownloadProgress = new DownloadParams.OnDownloadProgress() {
          public void onDownloadProgress(long contentLength, long bytesWritten) {
            WritableMap data = Arguments.createMap();

            data.putInt("jobId", jobId);
            data.putDouble("contentLength", (double)contentLength);
            data.putDouble("bytesWritten", (double)bytesWritten);

            sendEvent(getReactApplicationContext(), "DownloadProgress", data);
          }
        };
      }

      Downloader downloader = new Downloader();

      downloader.execute(params);

      this.downloaders.put(jobId, downloader);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, options.getString("toFile"), ex);
    }
  }

  @ReactMethod
  public void stopDownload(int jobId) {
    Downloader downloader = this.downloaders.get(jobId);

    if (downloader != null) {
      downloader.stop();
    }
  }

  @ReactMethod
  public void uploadFiles(final ReadableMap options, final Promise promise) {
    try {
      ReadableArray files = options.getArray("files");
      URL url = new URL(options.getString("toUrl"));
      final int jobId = options.getInt("jobId");
      ReadableMap headers = options.getMap("headers");
      ReadableMap fields = options.getMap("fields");
      String method = options.getString("method");
      boolean binaryStreamOnly = options.getBoolean("binaryStreamOnly");
      boolean hasBeginCallback = options.getBoolean("hasBeginCallback");
      boolean hasProgressCallback = options.getBoolean("hasProgressCallback");

      ArrayList<ReadableMap> fileList = new ArrayList<>();
      UploadParams params = new UploadParams();
      for(int i =0;i<files.size();i++){
        fileList.add(files.getMap(i));
      }
      params.src = url;
      params.files =fileList;
      params.headers = headers;
      params.method = method;
      params.fields = fields;
      params.binaryStreamOnly = binaryStreamOnly;
      params.onUploadComplete = new UploadParams.onUploadComplete() {
        public void onUploadComplete(UploadResult res) {
          if (res.exception == null) {
            WritableMap infoMap = Arguments.createMap();

            infoMap.putInt("jobId", jobId);
            infoMap.putInt("statusCode", res.statusCode);
            infoMap.putMap("headers",res.headers);
            infoMap.putString("body",res.body);
            promise.resolve(infoMap);
          } else {
            reject(promise, options.getString("toUrl"), res.exception);
          }
        }
      };

      if (hasBeginCallback) {
        params.onUploadBegin = new UploadParams.onUploadBegin() {
          public void onUploadBegin() {
            WritableMap data = Arguments.createMap();

            data.putInt("jobId", jobId);

            sendEvent(getReactApplicationContext(), "UploadBegin", data);
          }
        };
      }

      if (hasProgressCallback) {
        params.onUploadProgress = new UploadParams.onUploadProgress() {
          public void onUploadProgress(int totalBytesExpectedToSend,int totalBytesSent) {
            WritableMap data = Arguments.createMap();

            data.putInt("jobId", jobId);
            data.putInt("totalBytesExpectedToSend", totalBytesExpectedToSend);
            data.putInt("totalBytesSent", totalBytesSent);

            sendEvent(getReactApplicationContext(), "UploadProgress", data);
          }
        };
      }

      Uploader uploader = new Uploader();

      uploader.execute(params);

      this.uploaders.put(jobId, uploader);
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, options.getString("toUrl"), ex);
    }
  }

  @ReactMethod
  public void stopUpload(int jobId) {
    Uploader uploader = this.uploaders.get(jobId);

    if (uploader != null) {
      uploader.stop();
    }
  }

  @ReactMethod
  public void pathForBundle(String bundleNamed, Promise promise) {
    // TODO: Not sure what equivalent would be?
  }

  @ReactMethod
  public void pathForGroup(String bundleNamed, Promise promise) {
    // TODO: Not sure what equivalent would be?
  }

  @ReactMethod
  public void getFSInfo(Promise promise) {
    File path = Environment.getDataDirectory();
    StatFs stat = new StatFs(path.getPath());
    StatFs statEx = new StatFs(Environment.getExternalStorageDirectory().getPath());
    long totalSpace;
    long freeSpace;
    long totalSpaceEx = 0;
    long freeSpaceEx = 0;
    if (android.os.Build.VERSION.SDK_INT >= 18) {
      totalSpace = stat.getTotalBytes();
      freeSpace = stat.getFreeBytes();
      totalSpaceEx = statEx.getTotalBytes();
      freeSpaceEx = statEx.getFreeBytes();
    } else {
      long blockSize = stat.getBlockSize();
      totalSpace = blockSize * stat.getBlockCount();
      freeSpace = blockSize * stat.getAvailableBlocks();
    }
    WritableMap info = Arguments.createMap();
    info.putDouble("totalSpace", (double) totalSpace);   // Int32 too small, must use Double
    info.putDouble("freeSpace", (double) freeSpace);
    info.putDouble("totalSpaceEx", (double) totalSpaceEx);
    info.putDouble("freeSpaceEx", (double) freeSpaceEx);
    promise.resolve(info);
  }

  @ReactMethod
  public void touch(String filepath, double mtime, double ctime, Promise promise) {
    try {
      File file = new File(filepath);
      promise.resolve(file.setLastModified((long) mtime));
    } catch (Exception ex) {
      ex.printStackTrace();
      reject(promise, filepath, ex);
    }
  }

  @ReactMethod
  public void getAllExternalFilesDirs(Promise promise){
    File[] allExternalFilesDirs = this.getReactApplicationContext().getExternalFilesDirs(null);
    WritableArray fs = Arguments.createArray();
    for (File f : allExternalFilesDirs) {
      if (f != null) {
        fs.pushString(f.getAbsolutePath());
      }
    }
    promise.resolve(fs);
  }

  @ReactMethod
  public void scanFile(String path, final Promise promise) {
    MediaScannerConnection.scanFile(this.getReactApplicationContext(),
      new String[]{path},
      null,
      new MediaScannerConnection.MediaScannerConnectionClient() {
        @Override
        public void onMediaScannerConnected() {}
         @Override
        public void onScanCompleted(String path, Uri uri) {
          promise.resolve(path);
        }
      }
    );
  }

  // Required for rn built in EventEmitter Calls.
  @ReactMethod
  public void addListener(String eventName) {

  }

  @ReactMethod
  public void removeListeners(Integer count) {

  }

  private void reject(Promise promise, String filepath, Exception ex) {
    if (ex instanceof FileNotFoundException) {
      rejectFileNotFound(promise, filepath);
      return;
    }
    if (ex instanceof IORejectionException) {
      IORejectionException ioRejectionException = (IORejectionException) ex;
      promise.reject(ioRejectionException.getCode(), ioRejectionException.getMessage());
      return;
    }

    promise.reject(null, ex.getMessage());
  }

  private void rejectFileNotFound(Promise promise, String filepath) {
    promise.reject("ENOENT", "ENOENT: no such file or directory, open '" + filepath + "'");
  }

  private void rejectFileIsDirectory(Promise promise) {
    promise.reject("EISDIR", "EISDIR: illegal operation on a directory, read");
  }

  @Override
  public Map<String, Object> getConstants() {
    final Map<String, Object> constants = new HashMap<>();

    constants.put(RNFSDocumentDirectory, 0);
    constants.put(RNFSDocumentDirectoryPath, this.getReactApplicationContext().getFilesDir().getAbsolutePath());
    constants.put(RNFSTemporaryDirectoryPath, this.getReactApplicationContext().getCacheDir().getAbsolutePath());
    constants.put(RNFSPicturesDirectoryPath, Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES).getAbsolutePath());
    constants.put(RNFSCachesDirectoryPath, this.getReactApplicationContext().getCacheDir().getAbsolutePath());
    constants.put(RNFSDownloadDirectoryPath, Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).getAbsolutePath());
    constants.put(RNFSFileTypeRegular, 0);
    constants.put(RNFSFileTypeDirectory, 1);

    File externalStorageDirectory = Environment.getExternalStorageDirectory();
    if (externalStorageDirectory != null) {
      constants.put(RNFSExternalStorageDirectoryPath, externalStorageDirectory.getAbsolutePath());
    } else {
      constants.put(RNFSExternalStorageDirectoryPath, null);
    }

    File externalDirectory = this.getReactApplicationContext().getExternalFilesDir(null);
    if (externalDirectory != null) {
      constants.put(RNFSExternalDirectoryPath, externalDirectory.getAbsolutePath());
    } else {
      constants.put(RNFSExternalDirectoryPath, null);
    }

    File externalCachesDirectory = this.getReactApplicationContext().getExternalCacheDir();
    if (externalCachesDirectory != null) {
      constants.put(RNFSExternalCachesDirectoryPath, externalCachesDirectory.getAbsolutePath());
    } else {
      constants.put(RNFSExternalCachesDirectoryPath, null);
    }

    return constants;
  }
}
