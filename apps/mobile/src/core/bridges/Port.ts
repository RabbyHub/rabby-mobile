import {
  JS_POST_MESSAGE_TO_PROVIDER,
  JS_IFRAME_POST_MESSAGE_TO_PROVIDER,
} from '@rabby-wallet/rn-webview-bridge';

import { EventEmitter } from 'events';

/**
 * Module that listens for and responds to messages from an InpageBridge using postMessage for in-app browser
 */
class Port extends EventEmitter {
  #_isMainFrame: boolean;
  #webView: import('react-native-webview').WebView | null;

  // constructor(browserWindow: any, isMainFrame: boolean) {
  constructor(
    webView: import('react-native-webview').WebView,
    isMainFrame: boolean,
  ) {
    super();
    this.#webView = webView;
    this.#_isMainFrame = isMainFrame;
  }

  postMessage = (msg: any, origin = '*') => {
    const js = this.#_isMainFrame
      ? JS_POST_MESSAGE_TO_PROVIDER(msg, origin)
      : JS_IFRAME_POST_MESSAGE_TO_PROVIDER(msg, origin);

    if (this.#webView) {
      this.#webView.injectJavaScript(js);
    }
  };
}

export default Port;
