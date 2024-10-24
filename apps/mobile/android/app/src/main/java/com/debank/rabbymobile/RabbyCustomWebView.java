package com.debank.rabbymobile;

import com.facebook.react.module.annotations.ReactModule;

import android.webkit.WebChromeClient;

import com.facebook.react.uimanager.ThemedReactContext;
import com.reactnativecommunity.webview.RNCWebView;
import com.reactnativecommunity.webview.RNCWebViewClient;
import com.reactnativecommunity.webview.RNCWebViewManager;
import com.reactnativecommunity.webview.RNCWebViewWrapper;

@ReactModule(name = RabbyWebViewManager.REACT_CLASS)
class RabbyWebViewManager extends RNCWebViewManager {
  /* This name must match what we're referring to in JS */
  protected static final String REACT_CLASS = "RCTCustomWebView";

  protected static class CustomWebViewClient extends RNCWebViewClient {

  }

  protected static class CustomWebView extends RNCWebView {
    public CustomWebView(ThemedReactContext reactContext) {
      super(reactContext);
    }
  }

  @Override
  public RNCWebViewWrapper createViewInstance(ThemedReactContext reactContext) {
    RNCWebView wv = new CustomWebView(reactContext);
    return super.createViewInstance(reactContext, wv);
  }

  @Override
  public String getName() {
    return REACT_CLASS;
  }

  @Override
  protected void addEventEmitters(ThemedReactContext reactContext, RNCWebViewWrapper view) {
    view.getWebView().setWebViewClient(new CustomWebViewClient());
//    view.getWebView().setWebChromeClient(new WebChromeClient());
  }
}
