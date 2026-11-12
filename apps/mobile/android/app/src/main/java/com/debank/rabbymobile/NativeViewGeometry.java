package com.debank.rabbymobile;

import android.view.View;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.UIManagerHelper;

/** Measures mounted views, including native-stack headers reparented outside the shadow tree. */
final class NativeViewGeometry {
  static void measureRelativeTo(
      ReactApplicationContext context, int anchorTag, int viewportTag, Promise promise) {
    UiThreadUtil.runOnUiThread(() -> {
      try {
        View anchor = UIManagerHelper.getUIManagerForReactTag(context, anchorTag).resolveView(anchorTag);
        View viewport = UIManagerHelper.getUIManagerForReactTag(context, viewportTag).resolveView(viewportTag);
        if (anchor == null || viewport == null || !anchor.isAttachedToWindow() || !viewport.isAttachedToWindow()) {
          promise.reject("E_VIEW_UNAVAILABLE", "Tooltip views are not mounted");
          return;
        }
        int[] anchorPosition = new int[2];
        int[] viewportPosition = new int[2];
        anchor.getLocationOnScreen(anchorPosition);
        viewport.getLocationOnScreen(viewportPosition);
        WritableMap rect = Arguments.createMap();
        rect.putDouble("x", PixelUtil.toDIPFromPixel(anchorPosition[0] - viewportPosition[0]));
        rect.putDouble("y", PixelUtil.toDIPFromPixel(anchorPosition[1] - viewportPosition[1]));
        rect.putDouble("width", PixelUtil.toDIPFromPixel(anchor.getWidth()));
        rect.putDouble("height", PixelUtil.toDIPFromPixel(anchor.getHeight()));
        promise.resolve(rect);
      } catch (Exception error) {
        promise.reject("E_VIEW_UNAVAILABLE", "Tooltip views are not mounted");
      }
    });
  }
}
