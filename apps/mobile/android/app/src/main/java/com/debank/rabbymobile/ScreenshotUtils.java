package com.debank.rabbymobile;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import android.util.Base64;

/**
 * Utility class for capturing a screenshot of a given View and converting it to a Base64-encoded PNG string.
 * This implementation relies entirely on the View's own drawing logic, preserving transparency and visual fidelity.
 * It is particularly suitable for React Native applications where views may have transparent backgrounds
 * or complex layered content.
 */
public class ScreenshotUtils {
    public static class ScreenshotCaptureResult {
        public final String path;
        public final String name;
        public final int width;
        public final int height;

        ScreenshotCaptureResult(String path, String name, int width, int height) {
            this.path = path;
            this.name = name;
            this.width = width;
            this.height = height;
        }
    }

    /**
     * Captures the provided View as a PNG image and returns its Base64 representation.
     * The method ensures the View has valid dimensions before drawing.
     * If the View hasn't been laid out yet, it attempts to measure and layout manually.
     *
     * @param view The View to capture. Must not be null.
     * @return A Base64-encoded string of the PNG image, or null if capture fails.
     */
    public static String captureViewToPngBase64(View view) {
        if (view == null) {
            return null;
        }

        int width = view.getWidth();
        int height = view.getHeight();

        // If the view hasn't been laid out (e.g., called too early in lifecycle),
        // attempt to force measurement and layout.
        if (width <= 0 || height <= 0) {
            view.measure(
                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
            );
            view.layout(0, 0, view.getMeasuredWidth(), view.getMeasuredHeight());
            width = view.getMeasuredWidth();
            height = view.getMeasuredHeight();
        }

        // Final validation: abort if dimensions are still invalid.
        if (width <= 0 || height <= 0) {
            return null;
        }

        // Create a bitmap with alpha channel support (ARGB_8888).
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        // Let the view draw itself completely—including its background (if any),
        // children, and all visual effects that are drawable via standard View.draw().
        // Note: GPU-accelerated effects like RenderEffect (Android) or UIVisualEffectView (iOS)
        //       cannot be captured this way, but standard UI elements will render correctly.
        view.draw(canvas);

        // Convert the bitmap to a Base64-encoded PNG string.
        String pngBase64 = bitmapToPngBase64(bitmap);
        bitmap.recycle(); // Free native memory promptly to avoid OOM.
        return pngBase64;
    }

    /**
     * Captures the provided View as a PNG image and writes it directly to a sandbox file.
     */
    public static ScreenshotCaptureResult captureViewToPngFile(View view, File baseDir) {
        if (view == null || baseDir == null) {
            return null;
        }

        int width = view.getWidth();
        int height = view.getHeight();

        if (width <= 0 || height <= 0) {
            view.measure(
                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
            );
            view.layout(0, 0, view.getMeasuredWidth(), view.getMeasuredHeight());
            width = view.getMeasuredWidth();
            height = view.getMeasuredHeight();
        }

        if (width <= 0 || height <= 0) {
            return null;
        }

        File outputDir = new File(baseDir, "rabby-screen-capture");
        if (!outputDir.exists() && !outputDir.mkdirs()) {
            return null;
        }

        String fileName = "rabby-screen-capture-" + System.currentTimeMillis() + ".png";
        File outputFile = new File(outputDir, fileName);
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        try (FileOutputStream outputStream = new FileOutputStream(outputFile)) {
            view.draw(canvas);
            boolean success = bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
            outputStream.flush();
            if (!success) {
                outputFile.delete();
                return null;
            }
            return new ScreenshotCaptureResult(outputFile.getAbsolutePath(), fileName, width, height);
        } catch (Exception e) {
            e.printStackTrace();
            outputFile.delete();
            return null;
        } finally {
            bitmap.recycle();
        }
    }

    /**
     * Converts a Bitmap to a Base64-encoded PNG string without line wrapping.
     *
     * @param bitmap The input bitmap. Must not be null.
     * @return Base64 string of the compressed PNG, or null if input is invalid.
     */
    private static String bitmapToPngBase64(Bitmap bitmap) {
        if (bitmap == null) {
            return null;
        }

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        try {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
            byte[] pngBytes = outputStream.toByteArray();
            return Base64.encodeToString(pngBytes, Base64.NO_WRAP);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        } finally {
            try {
                outputStream.close();
            } catch (Exception ignored) {
                // Ignore close failure.
            }
        }
    }
}
