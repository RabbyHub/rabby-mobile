import { devLog } from '@/utils/logger';
import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';
import { useCallback, useRef, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';

export type WebViewState = Pick<
  WebViewNavigation,
  'canGoBack' | 'canGoForward' | 'loading' | 'title' | 'url'
>;

export type WebViewActions = ReturnType<
  typeof useWebViewControl
>['webviewActions'];

import { BLANK_PAGE } from '@/core/bridges/useBackgroundBridge';
export {
  BLANK_PAGE,
  BLANK_RABBY_PAGE,
} from '@/core/bridges/useBackgroundBridge';

function makeInnerDappTabId() {
  return `in${stringUtils.randString(8)}`;
}
export function useWebViewControl({ initialTabId }: { initialTabId?: string }) {
  const webviewRef = useRef<WebView>(null);
  const webviewIdRef = useRef<string>(initialTabId || makeInnerDappTabId());

  const urlRef = useRef<string>(BLANK_PAGE);
  const titleRef = useRef<string>('');
  const iconRef = useRef<string | undefined>();

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

      // update ref first, then trigger state update
      urlRef.current = newNavState.url || '';
      titleRef.current = newNavState.title || '';

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

  const go = useCallback((urlToGo: string) => {
    webviewRef?.current?.injectJavaScript(
      `(function(){window.location.href = '${urlUtils.sanitizeUrlInput(
        urlToGo,
      )}' })()`,
    );
  }, []);

  return {
    webviewState,
    webviewRef,
    webviewIdRef,
    urlRef,
    titleRef,
    iconRef,

    latestUrl: webviewState.url,

    webviewActions: {
      onNavigationStateChange,
      handleGoBack,
      handleGoForward,
      handleReload,
      go,
    },
  };
}
