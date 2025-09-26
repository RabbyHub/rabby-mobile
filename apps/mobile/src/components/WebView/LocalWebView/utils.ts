import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import WebView, { WebViewProps } from 'react-native-webview';

export function formatDevURI(input: {
  protocol?: 'http:' | 'https:';
  host: string;
  port?: number;
  path?: string;
}) {
  const { protocol = 'http:', host, port, path = '' } = input;
  const urlObj = new URL('', 'http://example.com');
  urlObj.protocol = protocol;
  urlObj.hostname = host;
  if (port) {
    urlObj.port = port.toString();
  }
  urlObj.pathname = path;

  return urlObj.toString();
  // return `${protocol}//${host}${port ? `:${port}` : ''}${path}`;
}

export function getBaseURL(uri: string) {
  try {
    const u = new URL(uri);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}/`;
  } catch (e) {
    return undefined;
  }
}

export function getLocalWebViewDefaultProps() {
  const baseWebViewProps: WebViewProps = {
    javaScriptEnabled: true,
    domStorageEnabled: true,
    originWhitelist: ['*'],
    mixedContentMode: 'compatibility',
    startInLoadingState: true,
    scrollEnabled: false,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    scalesPageToFit: false,
    webviewDebuggingEnabled: __DEV__,
    allowUniversalAccessFromFileURLs: true,
  };

  const iosWebViewProps: WebViewProps = {
    ...baseWebViewProps,
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    cacheEnabled: false,
    incognito: true,
    bounces: false,
    allowsFullscreenVideo: false,
    allowsBackForwardNavigationGestures: false,
    dataDetectorTypes: 'none' as const,
  };

  const androidWebViewProps: WebViewProps = {
    ...baseWebViewProps,
    nestedScrollEnabled: true,
    allowFileAccess: true,
  };

  return { iosWebViewProps, androidWebViewProps };
}

export const FALLBACK_HTML = /* html */ `
<!DOCTYPE html>
<html>
  <head>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: transparent;
    "
  ></body>
</html>
`;

const localWebViewAtom = atom({
  forceUseLocalResource: !__DEV__,
});

export function useLocalWebViewSettings() {
  const [localWebViewSettings, setLocalWebViewSettings] =
    useAtom(localWebViewAtom);

  const setForceLocalMode = useCallback(
    (forceUseLocalResource: boolean) => {
      setLocalWebViewSettings(prev => ({ ...prev, forceUseLocalResource }));
    },
    [setLocalWebViewSettings],
  );

  return {
    isUseLocalResource: localWebViewSettings.forceUseLocalResource || !__DEV__,
    setForceLocalMode,
  };
}

export function makeRuntimeInfo({
  baseUrl,
  isDev = __DEV__,
}: {
  baseUrl: string;
  isDev?: boolean;
}) {
  return {
    runtimeBaseUrl: baseUrl,
    platform: Platform.OS,
    isDev: isDev,
  };
}

export function sendMessageToWebview(webview: WebView | null, message: any) {
  if (!webview) {
    console.warn('sendMessageToWebview: webview is null');
    return;
  }

  const jsonStr =
    typeof message === 'string'
      ? message
      : JSON.stringify(message).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  // const jsCode = `window.dispatchEvent(new MessageEvent('message', { data: '${jsonStr}' }));true;`;

  const jsCode = `window.onMessageFromReactNative(${jsonStr});true;`;
  webview.injectJavaScript(jsCode);
}
