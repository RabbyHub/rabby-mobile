import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { Linking, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import WebView, { WebViewProps } from 'react-native-webview';

import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';

import { APP_UA_PARIALS, isNonPublicProductionEnv } from '@/constant';
import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import {
  BUILTIN_SPECIAL_URLS,
  useSetupWebview,
} from '@/core/bridges/useBackgroundBridge';
import { useWebViewControl } from '@/components/WebView/hooks';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { PATCH_ANCHOR_TARGET } from '@/core/bridges/builtInScripts/patchAnchor';
import { checkShouldStartLoadingWithRequestForDappWebView } from './utils';
import { getOnlineConfig } from '@/core/config/online';
import { useBrowser } from '@/hooks/browser/useBrowser';
import {
  getActiveDappState,
  globalSetActiveDappState,
} from '@/core/bridges/state';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { getDappAccount, useDapps } from '@/hooks/useDapps';
import { useAccounts } from '@/hooks/account';
//@ts-expect-error as string
import injectedAutoRunnerSource from '@/core/bridges/builtInScripts/innerDapp.webview.injected';
import { BrowserProgressBar } from '@/screens/Browser/BrowserScreen/components/BrowserTab/BrowserProgressBar';
import { useMemoizedFn } from 'ahooks';
import { WebviewError } from '@/screens/Browser/BrowserScreen/components/BrowserTab/WebivewError';
import { openExternalUrl } from '@/core/utils/linking';

const autoRunnerInjected = `${
  IS_ANDROID ? PATCH_ANCHOR_TARGET : ''
}\ntrue;${injectedAutoRunnerSource}\ntrue;`;

type OnLoadStartEvent = Parameters<NonNullable<WebViewProps['onLoadStart']>>[0];

export type DappWebViewController = ReturnType<typeof useWebViewControl>;

export type DappWebViewProgressState = {
  progress: number;
  isLoading: boolean;
};

export type DappWebViewCoreProps = {
  dappOrigin: string;
  url?: string;
  embedHtml?: string;
  controller?: DappWebViewController;
  webviewProps?: WebViewProps;
  contentMode?: WebViewProps['contentMode'];
  userAgent?: string;
  webviewKey?: string | number;
  webviewActive?: boolean;
  progressBar?: (state: DappWebViewProgressState) => React.ReactNode;
  onProgressStateChange?: (state: DappWebViewProgressState) => void;
  onLoadStart?: (event: OnLoadStartEvent, treatAsReload: boolean) => void;
  onLoadEnd?: WebViewProps['onLoadEnd'];
  onLoadProgress?: WebViewProps['onLoadProgress'];
  onShouldStartLoadWithRequest?: WebViewProps['onShouldStartLoadWithRequest'];
  onMessage?: WebViewProps['onMessage'];
  onError?: WebViewProps['onError'];
  renderError?: WebViewProps['renderError'];
  onLoad?: WebViewProps['onLoad'];
  onOpenWindow?: WebViewProps['onOpenWindow'];
  onNavigationStateChange?: WebViewProps['onNavigationStateChange'];
  onContentProcessDidTerminate?: WebViewProps['onContentProcessDidTerminate'];
  onRenderProcessGone?: WebViewProps['onRenderProcessGone'];
  onFileDownload?: WebViewProps['onFileDownload'];
  style?: StyleProp<ViewStyle>;
  offscreenPreload?: boolean;
};

function convertToWebviewUrl(dappOrigin: string) {
  if (__DEV__) {
    if (dappOrigin.startsWith('http://')) {
      return dappOrigin;
    }
  }

  if (BUILTIN_SPECIAL_URLS.includes(dappOrigin)) {
    return dappOrigin;
  }

  return stringUtils.ensurePrefix(dappOrigin, 'https://');
}

export default function DappWebViewCore({
  dappOrigin,
  url,
  embedHtml,
  controller,
  webviewProps,
  contentMode,
  userAgent,
  webviewKey,
  webviewActive = true,
  progressBar,
  onProgressStateChange,
  onLoadStart,
  onLoadEnd,
  onLoadProgress,
  onShouldStartLoadWithRequest,
  onMessage,
  onError,
  renderError,
  onLoad,
  onOpenWindow,
  onNavigationStateChange,
  onContentProcessDidTerminate,
  onRenderProcessGone,
  onFileDownload,
  style,
  offscreenPreload,
}: DappWebViewCoreProps) {
  const internalController = useWebViewControl({});
  const {
    webviewRef,
    webviewIdRef,
    urlRef,
    titleRef,
    iconRef,
    webviewState,
    setWebViewState,
    webviewActions,
  } = controller ?? internalController;

  const { dapps, disconnectDapp, setDapp, removeDapp } = useDapps();

  const dappInfo = useMemo(() => {
    return dapps[dappOrigin];
  }, [dapps, dappOrigin]);

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const account = useMemo(() => {
    return getDappAccount({ dappInfo, accounts });
  }, [accounts, dappInfo]);

  // const isLoadedRef = useRef(false);
  // const wasActiveRef = useRef(false);

  const injectedRef = useRef(false);

  const runActiveHook = useCallback(() => {
    if (!injectedRef.current) {
      injectedRef.current = true;
      webviewRef.current?.injectJavaScript(autoRunnerInjected);
    }
  }, [webviewRef]);

  // useEffect(() => {
  //   if (webviewActive && isLoadedRef.current && !wasActiveRef.current) {
  //     runActiveHook();
  //   }
  //   wasActiveRef.current = webviewActive;
  // }, [webviewActive, runActiveHook]);

  useEffect(() => {
    const tabId = internalController.webviewIdRef.current;
    const nextOrigin = safeGetOrigin(dappOrigin) || dappOrigin;

    // if (!webviewActive) {
    //   const activeState = getActiveDappState();
    //   if (activeState.tabId === tabId && !activeState.isScreenHide) {
    //     globalSetActiveDappState({ isScreenHide: true });
    //   }
    //   return;
    // }

    const activeState = getActiveDappState();
    if (
      activeState.tabId !== tabId ||
      activeState.isScreenHide ||
      activeState.dappOrigin !== nextOrigin
    ) {
      globalSetActiveDappState({
        dappOrigin: nextOrigin,
        tabId: offscreenPreload
          ? 'innerGlobalTabId'
          : internalController.webviewIdRef.current,
        isScreenHide: !webviewActive,
      });
    }
  }, [dappOrigin, internalController, offscreenPreload, webviewActive]);

  const { entryScriptWeb3Loaded, fullScript } =
    useJavaScriptBeforeContentLoaded();

  const { onLoadStart: onBridgeLoadStart, onMessage: onBridgeMessage } =
    useSetupWebview({
      dappOrigin,
      webviewRef,
      webviewIdRef,
      siteInfoRefs: {
        urlRef,
        titleRef,
        iconRef,
      },
      isFromMobileInnerDapp: true,
    });

  const resolvedUrl = useMemo(() => {
    if (embedHtml) return undefined;
    if (url) return url;
    if (!dappOrigin) return undefined;
    return convertToWebviewUrl(dappOrigin);
  }, [embedHtml, url, dappOrigin]);

  const {
    cacheEnabled = true,
    startInLoadingState = false,
    allowsFullscreenVideo = false,
    allowsInlineMediaPlayback = false,
    originWhitelist = ['*'],
    pullToRefreshEnabled = true,
    webviewDebuggingEnabled = isNonPublicProductionEnv,
    style: webviewStyle,
    source: _source,
    contentMode: webviewContentMode,
    userAgent: webviewUserAgent,
    applicationNameForUserAgent: webviewApplicationNameForUserAgent,
    scalesPageToFit: webviewScalesPageToFit,
    onLoadStart: webviewOnLoadStart,
    onLoadEnd: webviewOnLoadEnd,
    onLoadProgress: webviewOnLoadProgress,
    onShouldStartLoadWithRequest: webviewOnShouldStartLoadWithRequest,
    onMessage: webviewOnMessage,
    onError: webviewOnError,
    onOpenWindow: webviewOnOpenWindow,
    onNavigationStateChange: webviewOnNavigationStateChange,
    onContentProcessDidTerminate: webviewOnContentProcessDidTerminate,
    onRenderProcessGone: webviewOnRenderProcessGone,
    onFileDownload: webviewOnFileDownload,
    renderError: webviewRenderError,
    onLoad: webviewOnLoad,
    ...restWebviewProps
  } = webviewProps ?? {};

  const resolvedContentMode = contentMode ?? webviewContentMode;
  const resolvedUserAgent = userAgent ?? webviewUserAgent;
  const resolvedApplicationNameForUserAgent =
    webviewApplicationNameForUserAgent ??
    (resolvedUserAgent ? undefined : APP_UA_PARIALS.UA_FULL_NAME);
  const resolvedScalesPageToFit =
    resolvedContentMode === 'desktop'
      ? webviewScalesPageToFit ?? true
      : webviewScalesPageToFit;

  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(startInLoadingState);

  const updateProgressState = useCallback(
    (next: DappWebViewProgressState) => {
      setProgress(next.progress);
      setIsLoading(next.isLoading);
      onProgressStateChange?.(next);
    },
    [onProgressStateChange],
  );

  const handleLoadStart = useCallback(
    (event: OnLoadStartEvent) => {
      const alwaysTreatReloadAsTrue =
        IS_ANDROID &&
        !!getOnlineConfig()?.switches?.[
          '20250924.android_webview_always_treat_as_reload'
        ];

      let treatAsReload =
        IS_IOS || event.nativeEvent.isReload || alwaysTreatReloadAsTrue;

      if (!treatAsReload) {
        const eventUrlOrigin = urlUtils.canoicalizeDappUrl(
          event.nativeEvent.url,
        ).httpOrigin;
        const urlOrigin = urlUtils.canoicalizeDappUrl(
          webviewState.url,
        ).httpOrigin;
        const resolvedUrlOrigin = urlUtils.canoicalizeDappUrl(
          webviewState.resolvedUrl,
        ).httpOrigin;
        const originChanged =
          !webviewState.resolvedUrl ||
          eventUrlOrigin !== resolvedUrlOrigin ||
          urlOrigin !== resolvedUrlOrigin;
        treatAsReload = originChanged;
      }

      if (treatAsReload) {
        updateProgressState({ progress: 0, isLoading: true });
      }

      webviewOnLoadStart?.(event);
      onLoadStart?.(event, treatAsReload);
      onBridgeLoadStart(event, treatAsReload);
    },
    [
      onBridgeLoadStart,
      onLoadStart,
      updateProgressState,
      webviewOnLoadStart,
      webviewState.resolvedUrl,
      webviewState.url,
    ],
  );

  const handleLoadProgress = useCallback(
    (event: Parameters<NonNullable<WebViewProps['onLoadProgress']>>[0]) => {
      const nextProgress = event.nativeEvent.progress;
      updateProgressState(
        event.nativeEvent.progress === 1
          ? { isLoading: false, progress: 1 }
          : { isLoading: true, progress: nextProgress },
      );

      onLoadProgress?.(event);
      webviewOnLoadProgress?.(event);
    },
    [onLoadProgress, updateProgressState, webviewOnLoadProgress],
  );

  const handleLoadEnd = useCallback(
    (event: Parameters<NonNullable<WebViewProps['onLoadEnd']>>[0]) => {
      if (!event.nativeEvent.loading) {
        updateProgressState({
          progress: 1,
          isLoading: false,
        });
      }

      setWebViewState(prev => ({
        ...prev,
        resolvedUrl: event?.nativeEvent?.url,
      }));
      onLoadEnd?.(event);
      webviewOnLoadEnd?.(event);
    },
    [
      // webviewActive,
      setWebViewState,
      onLoadEnd,
      webviewOnLoadEnd,
      // runActiveHook,
      updateProgressState,
    ],
  );

  const handleMessage = useCallback(
    (event: Parameters<NonNullable<WebViewProps['onMessage']>>[0]) => {
      //@ts-expect-error 123123
      onBridgeMessage(event, true);
      onMessage?.(event);
      webviewOnMessage?.(event);
    },
    [onBridgeMessage, onMessage, webviewOnMessage],
  );

  const handleError = useCallback(
    (event: Parameters<NonNullable<WebViewProps['onError']>>[0]) => {
      setWebViewState(prev => ({
        ...prev,
        resolvedUrl: event.nativeEvent.url,
      }));
      onError?.(event);
      webviewOnError?.(event);
    },
    [onError, setWebViewState, webviewOnError],
  );

  const handleLoad = useCallback(
    (event: Parameters<NonNullable<WebViewProps['onLoad']>>[0]) => {
      onLoad?.(event);
      webviewOnLoad?.(event);
    },
    [onLoad, webviewOnLoad],
  );

  const handleNavigationStateChange = useCallback(
    (
      event: Parameters<
        NonNullable<WebViewProps['onNavigationStateChange']>
      >[0],
    ) => {
      webviewActions.onNavigationStateChange(event);
      onNavigationStateChange?.(event);
      webviewOnNavigationStateChange?.(event);
    },
    [onNavigationStateChange, webviewActions, webviewOnNavigationStateChange],
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (
      event: Parameters<
        NonNullable<WebViewProps['onShouldStartLoadWithRequest']>
      >[0],
    ) => {
      const shouldStart =
        checkShouldStartLoadingWithRequestForDappWebView(event);
      const extraResult = onShouldStartLoadWithRequest?.(event);
      const propsResult = webviewOnShouldStartLoadWithRequest?.(event);
      const shouldStartWithExtra =
        typeof extraResult === 'boolean' ? extraResult : true;
      const shouldStartWithProps =
        typeof propsResult === 'boolean' ? propsResult : true;
      const targetHost = safeGetOrigin(event.url);
      if (shouldStart && event.isTopFrame && targetHost.includes('scan')) {
        openExternalUrl(event.url);
        return false;
      }
      return shouldStart && shouldStartWithExtra && shouldStartWithProps;
    },
    [onShouldStartLoadWithRequest, webviewOnShouldStartLoadWithRequest],
  );

  const handleOpenWindow = useCallback(
    (event: Parameters<NonNullable<WebViewProps['onOpenWindow']>>[0]) => {
      console.log('handleOpenWindow', event);
      onOpenWindow?.(event);
      webviewOnOpenWindow?.(event);
    },
    [onOpenWindow, webviewOnOpenWindow],
  );

  const handleContentProcessDidTerminate = useCallback(
    (
      event: Parameters<
        NonNullable<WebViewProps['onContentProcessDidTerminate']>
      >[0],
    ) => {
      onContentProcessDidTerminate?.(event);
      webviewOnContentProcessDidTerminate?.(event);
    },
    [onContentProcessDidTerminate, webviewOnContentProcessDidTerminate],
  );

  const handleRenderProcessGone = useCallback(
    (
      event: Parameters<NonNullable<WebViewProps['onRenderProcessGone']>>[0],
    ) => {
      onRenderProcessGone?.(event);
      webviewOnRenderProcessGone?.(event);
    },
    [onRenderProcessGone, webviewOnRenderProcessGone],
  );

  const handleFileDownload = useCallback(
    (event: Parameters<NonNullable<WebViewProps['onFileDownload']>>[0]) => {
      onFileDownload?.(event);
      webviewOnFileDownload?.(event);
    },
    [onFileDownload, webviewOnFileDownload],
  );

  const handleGoTo = useMemoizedFn(async (urlToGo: string) => {
    if (!urlToGo || !/^https?:\/\//.test(urlToGo)) {
      return;
    }
    webviewRef.current?.stopLoading();
    setWebViewState(prev => ({ ...prev, resolvedUrl: urlToGo }));
    webviewRef?.current?.injectJavaScript(
      `window.location.href = '${urlUtils.sanitizeUrlInput(urlToGo)}';
            true; // Required for iOS
          `,
    );
    updateProgressState({
      isLoading: true,
      progress: 0.1,
    });
  });

  const handleOpenInBrowser = useMemoizedFn(() => {
    Linking.openURL(webviewState.resolvedUrl);
  });

  const defaultRenderError = useMemoizedFn(
    (errorDomain: string | undefined, errorCode: number, errorDesc: string) => {
      return (
        <WebviewError
          code={errorCode}
          message={errorDesc}
          onRefresh={() => {
            handleGoTo(webviewState.resolvedUrl || url || dappOrigin);
          }}
          onOpenInBrowser={handleOpenInBrowser}
        />
      );
    },
  );

  const progressBarNode = useMemo(() => {
    if (!progressBar) {
      return isLoading ? (
        <BrowserProgressBar progress={progress} style={styles.progressBar} />
      ) : null;
    }
    return progressBar({ progress, isLoading });
  }, [progressBar, progress, isLoading]);

  if (!entryScriptWeb3Loaded) {
    return <View style={[styles.placeholder, style]} />;
  }

  if (!embedHtml && !resolvedUrl) {
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <View style={[styles.container, style]}>
      {progressBarNode}
      <WebView
        allowsBackForwardNavigationGestures={true}
        key={webviewKey}
        cacheEnabled={cacheEnabled}
        startInLoadingState={startInLoadingState}
        allowsFullscreenVideo={allowsFullscreenVideo}
        allowsInlineMediaPlayback={allowsInlineMediaPlayback}
        originWhitelist={originWhitelist}
        pullToRefreshEnabled={pullToRefreshEnabled}
        {...restWebviewProps}
        style={[styles.webview, webviewStyle]}
        ref={webviewRef}
        source={{
          ...(embedHtml
            ? {
                html: embedHtml,
              }
            : {
                uri: resolvedUrl!,
              }),
        }}
        userAgent={resolvedUserAgent}
        applicationNameForUserAgent={resolvedApplicationNameForUserAgent}
        contentMode={resolvedContentMode}
        {...(resolvedScalesPageToFit !== undefined && {
          scalesPageToFit: resolvedScalesPageToFit,
        })}
        javaScriptEnabled
        injectedJavaScriptBeforeContentLoaded={fullScript}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
        // {...(IS_ANDROID && {
        //   injectedJavaScript: PATCH_ANCHOR_TARGET,
        // })}
        injectedJavaScript={autoRunnerInjected}
        webviewDebuggingEnabled={webviewDebuggingEnabled}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={handleLoadStart}
        onLoadProgress={handleLoadProgress}
        onLoad={handleLoad}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        renderError={renderError ?? (webviewRenderError || defaultRenderError)}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onMessage={handleMessage}
        // onOpenWindow={handleOpenWindow}
        onContentProcessDidTerminate={handleContentProcessDidTerminate}
        onRenderProcessGone={handleRenderProcessGone}
        onFileDownload={handleFileDownload}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
