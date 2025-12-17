import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import WebView, { WebViewProps } from 'react-native-webview';

import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import {
  refAssetForLocalWebView,
  WEBVIEW_BASEURL,
} from '@/core/storage/webviewAssets';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  GetDevUriFn,
  useDevServerHostAvailable,
} from '@/core/utils/devServerSettings';
import {
  FALLBACK_HTML,
  formatDevURI,
  getBaseURL,
  getLocalWebViewDefaultProps,
  makeRuntimeInfo,
  sendMessageToWebview,
} from './utils';
import { stringUtils } from '@rabby-wallet/base-utils';
import { OnShouldStartLoadWithRequest } from 'react-native-webview/lib/WebViewTypes';
import {
  useCreationWithDeepCompare,
  useCreationWithShallowCompare,
} from '@/hooks/common/useMemozied';
import { useAppLanguage } from '@/hooks/lang';

type LocalWebViewProps = WebViewProps & {
  entryPath: string;
  webviewSize?: { width?: number; height?: number };
  forceUseLocalResource?: boolean;
  /**
   * @default true disable http request in webview (for local resource security purpose)
   */
  disableHttpRequest?: boolean;
  i18nTexts?: Record<string, string>;
};

function defaultOnShouldStartLoadWithRequest(
  request: Parameters<OnShouldStartLoadWithRequest>[0],
  disableHttpRequest = true,
): ReturnType<OnShouldStartLoadWithRequest> {
  if (disableHttpRequest) {
    if (
      request.url.startsWith('http://') ||
      request.url.startsWith('https://')
    ) {
      // Prevent loading of HTTP URLs
      console.debug('[LocalWebView] Blocked HTTP request:', request.url);
      return false;
    }
  }

  // Allow all other URLs (e.g., HTTPS, file://)
  return true;
}

export type LocalWebView = WebView & {
  sendMessage?: (message: any) => void;
};
export const LocalWebView = React.forwardRef<LocalWebView, LocalWebViewProps>(
  (
    {
      entryPath,
      webviewSize,
      forceUseLocalResource: prop_forceUseLocalResource = !__DEV__,
      disableHttpRequest = !__DEV__,
      i18nTexts = {},
      ...webviewProps
    },
    ref,
  ) => {
    const { styles, isLight } = useTheme2024({ getStyle });
    const { currentLanguage } = useAppLanguage();
    // const { width: viewWidth = '100%', height: viewHeight = 300 } = viewSize || {};
    const { width: webviewWidth = '100%', height: webviewHeight = 300 } =
      webviewSize || {};

    const { devServerMobileLocalPagesAvailable, devServerHost, devUri } =
      useDevServerHostAvailable({
        autoDetectHost: true,
        devUri: useCallback<GetDevUriFn>(
          ctx => {
            return formatDevURI({
              host: ctx.devServerHost,
              port: 5173,
              protocol: 'http:',
              path: entryPath,
            });
          },
          [entryPath],
        ),
      });

    const { forceUseLocalResource } = useMemo(() => {
      if (__DEV__ && !prop_forceUseLocalResource) {
        if (!devServerHost) {
          // throw new Error('devServerHost is not set');
          const errorMsg =
            'devServerHost is not set, will use local resource fallback';
          console.warn(errorMsg);
          return { forceUseLocalResource: true };
        } else if (!devServerMobileLocalPagesAvailable) {
          const errorMsg = `Dev server host ${devServerHost} is not reachable, will use local resource fallback`;
          console.warn(errorMsg);
          return { forceUseLocalResource: true };
        }
      }

      return { forceUseLocalResource: prop_forceUseLocalResource };
    }, [
      prop_forceUseLocalResource,
      devServerHost,
      devServerMobileLocalPagesAvailable,
    ]);

    const { webviewSource } = useMemo(() => {
      const localUri = IS_ANDROID
        ? refAssetForLocalWebView(
            stringUtils.ensurePrefix(entryPath, '/builtin-pages'),
          ).rawPath
        : refAssetForLocalWebView(
            stringUtils.ensurePrefix(entryPath, '/builtin-pages'),
          ).rawPath;

      return {
        localUri,
        devUri,
        webviewSource:
          __DEV__ && !forceUseLocalResource
            ? {
                uri: devUri,
                baseUrl: getBaseURL(devUri || ''),
              }
            : IS_ANDROID
            ? {
                uri: localUri,
                baseUrl: `${stringUtils.ensureSuffix(WEBVIEW_BASEURL, '/')}`,
              }
            : {
                uri: `${WEBVIEW_BASEURL}${stringUtils.ensurePrefix(
                  entryPath,
                  '/builtin-pages',
                )}`,
                baseUrl: WEBVIEW_BASEURL,
              },
      };
    }, [entryPath, devUri, forceUseLocalResource]);

    const { onShouldStartLoadWithRequest: _onShouldStartLoadWithRequest } =
      webviewProps;
    const onShouldStartLoadWithRequest =
      useCallback<OnShouldStartLoadWithRequest>(
        request => {
          const internalAllowed = defaultOnShouldStartLoadWithRequest(
            request,
            disableHttpRequest,
          );

          const externalAllowed =
            _onShouldStartLoadWithRequest?.(request) !== false;

          return internalAllowed && externalAllowed;
        },
        [_onShouldStartLoadWithRequest, disableHttpRequest],
      );

    const webviewRef: React.MutableRefObject<WebView | null> =
      React.useRef<WebView>(null);

    const deepComparedI18nText = useCreationWithDeepCompare(
      () => i18nTexts,
      [i18nTexts],
    );
    const runtimeInfo = useCreationWithShallowCompare(() => {
      return makeRuntimeInfo({
        baseUrl: webviewSource.baseUrl!,
        useDevResource: __DEV__ && !forceUseLocalResource,
        isDark: !isLight,
        language: currentLanguage,
        i18nTexts: deepComparedI18nText,
      });
    }, [
      webviewSource.baseUrl,
      forceUseLocalResource,
      isLight,
      currentLanguage,
      deepComparedI18nText,
    ]);
    useEffect(() => {
      sendMessageToWebview(webviewRef.current, {
        type: 'GOT_RUNTIME_INFO',
        info: runtimeInfo,
      });
    }, [runtimeInfo]);

    const [windowInfo, setWindowInfo] = useState<{
      width: number;
      height: number;
    } | null>(null);
    useImperativeHandle(ref, () => {
      return Object.assign(
        {
          sendMessage: (message: any) => {
            sendMessageToWebview(webviewRef.current, message);
          },
        },
        webviewRef.current as WebView,
      );
    });
    useEffect(() => {
      if (!windowInfo) return;
      sendMessageToWebview(webviewRef.current, {
        type: 'GOT_WINDOW_INFO',
        info: { ...windowInfo },
      });
    }, [windowInfo]);

    return (
      <WebView
        {...(IS_IOS
          ? getLocalWebViewDefaultProps().iosWebViewProps
          : getLocalWebViewDefaultProps().androidWebViewProps)}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        {...webviewProps}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setWindowInfo({ width, height });
        }}
        style={[
          styles.webView,
          {
            height: webviewHeight,
            width: webviewWidth,
            minHeight: webviewHeight,
          },
          webviewProps.style,
        ]}
        ref={(instance: WebView) => {
          webviewRef.current = instance;
        }}
        source={{
          ...webviewProps.source,
          ...webviewSource,
        }}
        injectedJavaScriptObject={{
          ...webviewProps.injectedJavaScriptObject,
          ...runtimeInfo,
        }}
        onMessage={event => {
          webviewProps.onMessage?.(event);
          const parseInfo = stringUtils.safeParseJSON(event.nativeEvent.data);

          switch (parseInfo?.type) {
            case 'GET_RUNTIME_INFO': {
              sendMessageToWebview(webviewRef.current, {
                type: 'GOT_RUNTIME_INFO',
                info: runtimeInfo,
              });
              break;
            }
            case 'GET_WINDOW_INFO': {
              if (windowInfo) {
                sendMessageToWebview(webviewRef.current, {
                  type: 'GOT_WINDOW_INFO',
                  info: windowInfo,
                });
              }
              break;
            }
            default: {
              console.warn('Unknown message from WebView', parseInfo);
            }
          }
        }}
      />
    );
  },
);

const getStyle = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
}));
