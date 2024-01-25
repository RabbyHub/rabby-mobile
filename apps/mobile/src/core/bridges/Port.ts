import {
  JS_POST_MESSAGE_TO_PROVIDER,
  JS_IFRAME_POST_MESSAGE_TO_PROVIDER,
} from '@rabby-wallet/rn-webview-bridge';

import { EventEmitter } from 'events';

/**
 * Module that listens for and responds to messages from an InpageBridge using postMessage for in-app browser
 */
class Port extends EventEmitter {
  name: string;

  #_isMainFrame: boolean;
  #webView: import('react-native-webview').WebView | null;

  // constructor(browserWindow: any, isMainFrame: boolean) {
  constructor(
    webView: import('react-native-webview').WebView | null,
    isMainFrame: boolean,
  ) {
    super();

    this.name = '???';
    this.#webView = webView;
    this.#_isMainFrame = isMainFrame;
  }

  postMessage = (msg: any, origin = '*') => {
    const js = this.#_isMainFrame
      ? JS_POST_MESSAGE_TO_PROVIDER(msg, origin)
      : JS_IFRAME_POST_MESSAGE_TO_PROVIDER(msg, origin);

    this.#webView?.injectJavaScript(js);
  };
}

export default Port;
