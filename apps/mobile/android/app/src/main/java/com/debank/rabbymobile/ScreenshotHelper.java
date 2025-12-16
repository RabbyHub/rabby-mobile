package com.debank.rabbymobile;

import androidx.annotation.NonNull;
import android.app.Activity;

import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import android.Manifest;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import androidx.core.content.ContextCompat;

/**
 * A standalone utility class for detecting and retrieving recent screenshots.
 * Can be reused in ScreenshotDetectorModule or other scenarios requiring screenshot functionality.
 */
public class ScreenshotHelper {
    private static final String TAG = "ScreenshotHelper";

    // Common screenshot directories (relative to Environment.DIRECTORY_PICTURES/DCIM)
    private static final String[] SCREENSHOT_PATHS = {
        "Pictures/Screenshots",
        "DCIM/Screenshots",
        "Pictures/Screenshot",
        "DCIM/Screenshot"
    };

    // Common patterns used to match screenshot filenames
    private static final String[] SCREENSHOT_PATTERNS = {
        "screenshot", "screen_shot", "screen-shot", "screen shot",
        "screencapture", "screen_capture", "screen-capture", "screen capture",
        "screencap", "screen_cap", "screen-cap", "screen cap",
        "screenshot", "screen shot", "screen capture",
        "captura de pantalla", "écran", "capture d'écran", "schermata", "cattura schermo"
    };

    // Timestamp pattern (matches YYYY-MM-DD HH.MM.SS or similar formats)
    private static final String TIMESTAMP_PATTERN = "\\d{4}[-_]\\d{2}[-_]\\d{2}.*\\d{2}[._-]\\d{2}[._-]\\d{2}";


    // =================================================================================
    // === Static API (for external calls) ===
    // =================================================================================

    /**
     * Check if the app has permission to read image media.
     * @param activity Context for checking permission
     * @return true if permission is granted
     */
    public static boolean hasReadMediaImagesPermission(@NonNull Activity activity) {
        return ContextCompat.checkSelfPermission(
            activity, Manifest.permission.READ_MEDIA_IMAGES
        ) == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Check if the given relative path and filename is likely a screenshot.
     *
     * @param relativePath Relative path of the screenshot (e.g.: "Pictures/Screenshots/")
     * @param displayName  Display name of the file (e.g.: "Screenshot_20231027-142305.jpg")
     * @return true if it is a screenshot
     */
    public static boolean isLikelyScreenshot(String relativePath, String displayName) {
        if (relativePath == null || displayName == null) return false;

        String lowerRelativePath = relativePath.toLowerCase();
        String lowerDisplayName = displayName.toLowerCase();

        // Check path
        for (String path : SCREENSHOT_PATHS) {
            if (lowerRelativePath.contains(path.toLowerCase())) {
                return true;
            }
        }

        // Check keywords in filename
        for (String pattern : SCREENSHOT_PATTERNS) {
            if (lowerDisplayName.contains(pattern)) {
                return true;
            }
        }

        // Check if it matches timestamp naming pattern
        return displayName.matches(TIMESTAMP_PATTERN);
    }

    private static String C_WIDTH = "width";
    private static String C_HEIGHT = "height";
    /**
     * Query MediaStore to get recent screenshot information.
     *
     * @param contentResolver ContentResolver instance
     * @param maxResults      Maximum number of screenshots to return
     * @param withinSeconds   Query time range (seconds), e.g. 60 means screenshots from the past 1 minute
     * @return List containing screenshot information
     */
    public static List<ScreenshotInfo> queryRecentScreenshots(ContentResolver contentResolver,
                                                              int maxResults,
                                                              int withinSeconds) {
        List<ScreenshotInfo> screenshots = new ArrayList<>();
        String[] projection = {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.RELATIVE_PATH,
                MediaStore.Images.Media.DATA,
                MediaStore.Images.Media.SIZE,
                C_WIDTH,
                C_HEIGHT
        };

        long cutoffTime = (System.currentTimeMillis() / 1000) - withinSeconds;
        String selection = MediaStore.Images.Media.DATE_ADDED + " >= ?";
        String[] selectionArgs = {String.valueOf(cutoffTime)};
        String sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC";

        Cursor cursor = null;
        try {
            cursor = contentResolver.query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    selectionArgs,
                    sortOrder
            );

            if (cursor != null && cursor.moveToFirst()) {
                int count = 0;
                do {
                    if (count >= maxResults) break;

                    String relativePath = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.RELATIVE_PATH));
                    String displayName = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME));

                    // Filter using isLikelyScreenshot
                    if (isLikelyScreenshot(relativePath, displayName)) {
                        long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));

                        long dateAdded = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED));
                        Long size = cursor.isNull(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)) ?
                                null : cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE));
                        long width = cursor.isNull(cursor.getColumnIndexOrThrow(C_WIDTH)) ?
                                0 : cursor.getLong(cursor.getColumnIndexOrThrow(C_WIDTH));
                        long height = cursor.isNull(cursor.getColumnIndexOrThrow(C_HEIGHT)) ?
                                0 : cursor.getLong(cursor.getColumnIndexOrThrow(C_HEIGHT));
                        Uri imageUri = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, String.valueOf(id));
                        String fullPath = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA));
                        ScreenshotInfo info = new ScreenshotInfo(id, displayName, dateAdded, relativePath, fullPath, size, width, height, imageUri);
                        screenshots.add(info);
                        count++;
                    }
                } while (cursor.moveToNext());
            }
        } catch (SecurityException e) {
          Log.e(TAG, "Permission denied to read external storage", e);
          // Prompt user to grant permission in settings, or guide user to request permission
        } catch (Exception e) {
            Log.e(TAG, "Error querying recent screenshots", e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        return screenshots;
    }

    /**
     * Read screenshot image from Uri and convert to byte array.
     *
     * @param contentResolver ContentResolver instance
     * @param imageUri        Uri of the screenshot
     * @param quality         JPEG compression quality (0-100)
     * @return Byte array of the image data, returns null on failure
     */
    @androidx.annotation.Nullable
    public static byte[] getImageData(ContentResolver contentResolver, Uri imageUri, int quality) {
        try (InputStream inputStream = contentResolver.openInputStream(imageUri)) {
            if (inputStream != null) {
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                if (bitmap != null) {
                    ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
                    bitmap.compress(Bitmap.CompressFormat.JPEG, quality, byteArrayOutputStream);
                    byte[] byteArray = byteArrayOutputStream.toByteArray();
                    return byteArray;
                }
            }
        } catch (IOException e) {
            Log.e(TAG, "Error reading image data from URI: " + imageUri, e);
        } catch (OutOfMemoryError e) {
            Log.e(TAG, "Out of memory when decoding image from URI: " + imageUri, e);
        }
        return null;
    }

    /**
     * Read screenshot image from Uri and convert to Base64 string.
     * Note: This operation may be time-consuming and should be executed on a background thread.
     *
     * @param contentResolver ContentResolver instance
     * @param imageUri        Uri of the screenshot
     * @param quality         JPEG compression quality (0-100)
     * @return Base64 encoded image string, returns null on failure
     */
    @androidx.annotation.Nullable
    public static String getImageBase64(ContentResolver contentResolver, Uri imageUri, int quality) {
        byte[] byteArray = getImageData(contentResolver, imageUri, quality);
        if (byteArray != null) {
            return Base64.encodeToString(byteArray, Base64.DEFAULT);
        }
        return null;
    }
    @androidx.annotation.Nullable
    public static String getImageBase64(byte[] byteArray) {
        if (byteArray != null) {
            return Base64.encodeToString(byteArray, Base64.DEFAULT);
        }
        return null;
    }

    /**
     * A simple data class encapsulating screenshot information.
     */
    public static class ScreenshotInfo {
        public final long id;
        public final String displayName;
        public final long dateAdded; // Unix timestamp (seconds)
        public final String relativePath;
        public final String fullPath;
        public final Long size; // Size in bytes, can be null
        public final long width; // Width in pixels
        public final long height; // Height in pixels
        public final Uri uri;

        public ScreenshotInfo(long id, String displayName, long dateAdded, String relativePath, String fullPath, Long size, long width, long height, Uri uri) {
            this.id = id;
            this.displayName = displayName;
            this.dateAdded = dateAdded;
            this.relativePath = relativePath;
            this.fullPath = fullPath;
            this.size = size;
            this.width = width;
            this.height = height;
            this.uri = uri;
        }

        @Override
        public String toString() {
            return "ScreenshotInfo{" +
                    "id=" + id +
                    ", displayName='" + displayName + '\'' +
                    ", dateAdded=" + dateAdded +
                    ", relativePath='" + relativePath + '\'' +
                    ", fullPath='" + fullPath + '\'' +
                    ", size=" + size +
                    ", width=" + width +
                    ", height=" + height +
                    ", uri=" + uri +
                    '}';
        }
    }
}
