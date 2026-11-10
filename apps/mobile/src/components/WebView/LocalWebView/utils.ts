import { SupportedLang } from '@/utils/i18n';
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

export const LOCAL_WEBVIEW_FILE_ACCESS_PROPS = {
  // Android assets remain available without access to app/user files.
  allowFileAccess: false,
  // Bundled ES modules need file-origin access; arbitrary origins do not.
  // iOS additionally scopes its native read grant to builtin-pages.
  allowFileAccessFromFileURLs: true,
  allowUniversalAccessFromFileURLs: false,
} satisfies WebViewProps;

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
    ...LOCAL_WEBVIEW_FILE_ACCESS_PROPS,
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
  useDevResource = __DEV__,
  isDark = false,
  language = SupportedLang['en-US'],
  i18nTexts = {},
  backGroundColor,
}: {
  baseUrl: string;
  useDevResource?: boolean;
  isDark: boolean;
  language?: SupportedLang;
  i18nTexts?: Record<string, string>;
  backGroundColor?: string;
}) {
  return {
    runtimeBaseUrl: baseUrl,
    platform: Platform.OS,
    useDevResource: useDevResource,
    isDark: isDark,
    language,
    // colors2024: ThemeColors2024[isDark ? 'dark' : 'light'],
    i18nTexts,
    backGroundColor,
  };
}

export function sendMessageToWebview(webview: WebView | null, message: any) {
  if (!webview) {
    console.warn('sendMessageToWebview: webview is null');
    return;
  }

  // Quote the serialized JSON as a string, then parse it in the WebView. This
  // keeps labels and string messages as data, including keys like __proto__.
  const jsonStr = JSON.stringify(message);
  const detailExpression =
    jsonStr === undefined
      ? 'undefined'
      : `JSON.parse(${JSON.stringify(jsonStr)
          .replace(/\u2028/g, '\\u2028')
          .replace(/\u2029/g, '\\u2029')})`;

  const jsCode = `
var event = new CustomEvent('messageFromRN', {
  detail: ${detailExpression},
  bubbles: true, // Allow the event to bubble up the DOM
  cancelable: true // Allow preventDefault() to be called
})
window.dispatchEvent(event);
true;`;
  webview.injectJavaScript(jsCode);
}
