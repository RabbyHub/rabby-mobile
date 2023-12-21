import { devLog } from '@/utils/logger';
import { useCallback, useRef, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';

export type WebViewState = Pick<
  WebViewNavigation,
  'canGoBack' | 'canGoForward' | 'loading' | 'title' | 'url'
>;

export function useWebViewControl() {
  const webviewRef = useRef<WebView>(null);

  const [webviewState, setWebViewState] = useState<WebViewState>({
    canGoBack: false,
    canGoForward: false,
    loading: false,
    title: '',
    url: '',
  });

  const onNavigationStateChange = useCallback(
    (newNavState: WebViewNavigation) => {
      // // leave here for debug
      // devLog('onNavigationStateChange::newNavState', newNavState);

      setWebViewState({
        canGoBack: newNavState.canGoBack,
        canGoForward: newNavState.canGoForward,
        loading: newNavState.loading,
        title: newNavState.title,
        url: newNavState.url,
      });

      if (!newNavState.url) {
        return;
      }
    },
    [],
  );

  const handleGoBack = useCallback((event?: GestureResponderEvent) => {
    webviewRef?.current?.goBack();
  }, []);

  const handleGoForward = useCallback((event?: GestureResponderEvent) => {
    webviewRef?.current?.goForward();
  }, []);

  const handleReload = useCallback((event?: GestureResponderEvent) => {
    webviewRef?.current?.reload();
  }, []);

  return {
    webviewState,
    webviewRef,
    latestUrl: webviewState.url,

    webviewActions: {
      onNavigationStateChange,
      handleGoBack,
      handleGoForward,
      handleReload,
    },
  };
}
