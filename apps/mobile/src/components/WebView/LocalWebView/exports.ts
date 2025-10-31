import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import WebView from 'react-native-webview';

/**
 * @description maybe useful in the future
 * @param webviewInst
 */
export function clearWebViewCache(webviewInst: WebView) {
  if (IS_ANDROID) {
    webviewInst.clearHistory?.();
    webviewInst.clearFormData?.();
    webviewInst.clearCache?.(true);
  } else if (IS_IOS) {
    // webviewInst.clearCache will be available in the future's version
  }
}
