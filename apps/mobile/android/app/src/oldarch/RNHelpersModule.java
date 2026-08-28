package com.debank.rabbymobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;
import androidx.core.view.ViewCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.NativeViewHierarchyManager;
import com.facebook.react.uimanager.UIBlock;
import com.facebook.react.uimanager.UIManagerModule;
import com.facebook.react.views.scroll.ReactScrollView;

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
  public void getPerpsProPagerProbeSnapshot(double rawReactTag, Promise promise) {
    if (
      !BuildConfig.DEBUG &&
      "com.debank.rabbymobile".equals(BuildConfig.APPLICATION_ID)
    ) {
      promise.reject(
        "E_PERPS_PRO_PAGER_PROBE_DISABLED",
        "Perps Pro pager probe is unavailable in public production builds"
      );
      return;
    }
    int reactTag = (int) rawReactTag;
    UIManagerModule uiManager = reactContext.getNativeModule(UIManagerModule.class);
    if (uiManager == null) {
      promise.reject(
        "E_PERPS_PRO_PAGER_PROBE_UI_MANAGER",
        "Paper UIManager is unavailable"
      );
      return;
    }

    uiManager.addUIBlock(
      new UIBlock() {
        @Override
        public void execute(NativeViewHierarchyManager hierarchyManager) {
          try {
            View resolvedView = hierarchyManager.resolveView(reactTag);
            ReactScrollView scrollView = findReactScrollView(resolvedView);
            WritableMap snapshot = Arguments.createMap();
            snapshot.putInt("reactTag", reactTag);
            snapshot.putInt("resolvedTag", resolvedView.getId());
            snapshot.putString(
              "resolvedClass",
              resolvedView.getClass().getSimpleName()
            );
            snapshot.putBoolean(
              "resolvedAttached",
              ViewCompat.isAttachedToWindow(resolvedView)
            );
            snapshot.putBoolean(
              "resolvedLaidOut",
              ViewCompat.isLaidOut(resolvedView)
            );

            if (scrollView == null) {
              snapshot.putBoolean("scrollViewFound", false);
              promise.resolve(snapshot);
              return;
            }

            View contentView = scrollView.getChildCount() > 0
              ? scrollView.getChildAt(0)
              : null;
            int viewportHeight = Math.max(
              0,
              scrollView.getHeight() - scrollView.getPaddingTop() - scrollView.getPaddingBottom()
            );
            int contentHeight = contentView == null ? 0 : contentView.getHeight();
            int[] windowLocation = new int[] { 0, 0 };
            scrollView.getLocationInWindow(windowLocation);

            snapshot.putBoolean("scrollViewFound", true);
            snapshot.putInt("scrollTag", scrollView.getId());
            snapshot.putString(
              "scrollClass",
              scrollView.getClass().getSimpleName()
            );
            snapshot.putBoolean(
              "scrollAttached",
              ViewCompat.isAttachedToWindow(scrollView)
            );
            snapshot.putBoolean(
              "scrollLaidOut",
              ViewCompat.isLaidOut(scrollView)
            );
            snapshot.putInt("scrollVisibility", scrollView.getVisibility());
            snapshot.putDouble("scrollAlpha", scrollView.getAlpha());
            snapshot.putInt("scrollX", scrollView.getScrollX());
            snapshot.putInt("scrollY", scrollView.getScrollY());
            snapshot.putInt("scrollWidth", scrollView.getWidth());
            snapshot.putInt("scrollHeight", scrollView.getHeight());
            snapshot.putInt("scrollTop", scrollView.getTop());
            snapshot.putInt("scrollBottom", scrollView.getBottom());
            snapshot.putDouble("scrollTranslationY", scrollView.getTranslationY());
            snapshot.putInt("scrollWindowX", windowLocation[0]);
            snapshot.putInt("scrollWindowY", windowLocation[1]);
            snapshot.putInt("viewportHeight", viewportHeight);
            snapshot.putInt("contentHeight", contentHeight);
            snapshot.putInt(
              "maxScrollY",
              Math.max(0, contentHeight - viewportHeight)
            );
            snapshot.putString(
              "scrollParentClass",
              scrollView.getParent() == null
                ? ""
                : scrollView.getParent().getClass().getSimpleName()
            );

            View pager = findViewPager(scrollView);
            snapshot.putBoolean("pagerFound", pager != null);
            if (pager != null) {
              int[] pagerWindowLocation = new int[] { 0, 0 };
              pager.getLocationInWindow(pagerWindowLocation);
              snapshot.putInt(
                "pagerCurrentItem",
                invokePagerIntMethod(pager, "getCurrentItem")
              );
              snapshot.putInt(
                "pagerScrollState",
                invokePagerIntMethod(pager, "getScrollState")
              );
              snapshot.putInt(
                "pagerOffscreenPageLimit",
                invokePagerIntMethod(pager, "getOffscreenPageLimit")
              );
              snapshot.putBoolean(
                "pagerAttached",
                ViewCompat.isAttachedToWindow(pager)
              );
              snapshot.putBoolean("pagerLaidOut", ViewCompat.isLaidOut(pager));
              snapshot.putInt("pagerWidth", pager.getWidth());
              snapshot.putInt("pagerHeight", pager.getHeight());
              snapshot.putInt("pagerTop", pager.getTop());
              snapshot.putInt("pagerBottom", pager.getBottom());
              snapshot.putDouble("pagerTranslationY", pager.getTranslationY());
              snapshot.putInt("pagerWindowX", pagerWindowLocation[0]);
              snapshot.putInt("pagerWindowY", pagerWindowLocation[1]);
            }

            View pageView = findPagerPageView(scrollView);
            snapshot.putBoolean("pagerPageFound", pageView != null);
            if (pageView != null) {
              int[] pageWindowLocation = new int[] { 0, 0 };
              pageView.getLocationInWindow(pageWindowLocation);
              snapshot.putBoolean(
                "pagerPageAttached",
                ViewCompat.isAttachedToWindow(pageView)
              );
              snapshot.putBoolean(
                "pagerPageLaidOut",
                ViewCompat.isLaidOut(pageView)
              );
              snapshot.putInt("pagerPageTop", pageView.getTop());
              snapshot.putInt("pagerPageBottom", pageView.getBottom());
              snapshot.putInt("pagerPageWidth", pageView.getWidth());
              snapshot.putInt("pagerPageHeight", pageView.getHeight());
              snapshot.putDouble(
                "pagerPageTranslationY",
                pageView.getTranslationY()
              );
              snapshot.putInt("pagerPageWindowX", pageWindowLocation[0]);
              snapshot.putInt("pagerPageWindowY", pageWindowLocation[1]);
            }
            promise.resolve(snapshot);
          } catch (Exception error) {
            promise.reject("E_PERPS_PRO_PAGER_PROBE_SNAPSHOT", error);
          }
        }
      }
    );
  }

  private ReactScrollView findReactScrollView(View root) {
    if (root instanceof ReactScrollView) {
      return (ReactScrollView) root;
    }
    if (!(root instanceof ViewGroup)) {
      return null;
    }
    ViewGroup group = (ViewGroup) root;
    for (int index = 0; index < group.getChildCount(); index++) {
      ReactScrollView result = findReactScrollView(group.getChildAt(index));
      if (result != null) {
        return result;
      }
    }
    return null;
  }

  private View findViewPager(View view) {
    android.view.ViewParent parent = view.getParent();
    int depth = 0;
    while (parent != null && depth < 12) {
      if (
        parent instanceof View &&
        "androidx.viewpager2.widget.ViewPager2".equals(parent.getClass().getName())
      ) {
        return (View) parent;
      }
      parent = parent.getParent();
      depth += 1;
    }
    return null;
  }

  private int invokePagerIntMethod(View pager, String methodName) {
    try {
      Object value = pager.getClass().getMethod(methodName).invoke(pager);
      return value instanceof Number ? ((Number) value).intValue() : -1;
    } catch (Exception ignored) {
      return -1;
    }
  }

  private View findPagerPageView(View view) {
    View current = view;
    int depth = 0;
    while (current.getParent() != null && depth < 12) {
      android.view.ViewParent parent = current.getParent();
      android.view.ViewParent grandparent = parent.getParent();
      if (
        "androidx.recyclerview.widget.RecyclerView".equals(
          parent.getClass().getName()
        ) &&
        grandparent != null &&
        "androidx.viewpager2.widget.ViewPager2".equals(
          grandparent.getClass().getName()
        )
      ) {
        return current;
      }
      if (!(parent instanceof View)) {
        return null;
      }
      current = (View) parent;
      depth += 1;
    }
    return null;
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
