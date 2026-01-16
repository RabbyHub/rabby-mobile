/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Linking,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import WebView, { WebViewProps } from 'react-native-webview';

import { ScreenLayouts2 } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import {
  useWebViewControl,
  WebViewActions,
  WebViewState,
} from '@/components/WebView/hooks';
import { checkShouldStartLoadingWithRequestForDappWebView } from '@/components/WebView/utils';
import { APP_UA_PARIALS } from '@/constant';
import { DESKTOP_MODE_UA, USER_AGENT } from '@/constant/browser';
import { parsePossibleURL } from '@/constant/dappView';
import { isNonPublicProductionEnv } from '@/constant';
import { PATCH_ANCHOR_TARGET } from '@/core/bridges/builtInScripts/patchAnchor';
import { useSetupWebview } from '@/core/bridges/useBackgroundBridge';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import {
  browserService,
  dappService,
  perpsService,
  preferenceService,
} from '@/core/services';
import { Tab } from '@/core/services/browserService';
import { FontNames } from '@/core/utils/fonts';
import {
  useBrowser,
  useBrowserActiveTabState,
} from '@/hooks/browser/useBrowser';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import { getDappAccount, useDapps } from '@/hooks/useDapps';
import { matomoRequestEvent } from '@/utils/analytics';
import { sleep } from '@/utils/async';
import { isGoogle, isValidAppStoreUrl } from '@/utils/browser';
import { coerceInteger } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import {
  canoicalizeDappUrl,
  safeGetOrigin,
} from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useDebounce, useMemoizedFn } from 'ahooks';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import ViewShot from 'react-native-view-shot';
import { BrowserFooter } from './BrowserFooter';
import { BrowserHeader } from './BrowserHeader';
import { BrowserProgressBar } from './BrowserProgressBar';
import { EVENT_BROWSER_ACTION, eventBus } from '@/utils/events';
import { Freeze } from 'react-freeze';
import { AsterPerpsInvitePopup } from './AsterPerpsInvitePopup';
import { PERPS_ASTER_INVITE_URL, PERPS_INVITE_URL } from '@/constant/perps';
import { CurrentDappPopup } from './CurrentDappPopup';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import {
  useAsterReferral,
  useHyperliquidReferral,
} from '../../hooks/useHyperliquidReferral';
import { useAccounts } from '@/hooks/account';
import { getOnlineConfig } from '@/core/config/online';
import { WebviewError } from './WebivewError';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { toast } from '@/components2024/Toast';
import { useTranslation } from 'react-i18next';
import { PerpsInvitePopup } from '@/screens/Perps/components/PerpsInvitePopup';

type BrowserTabProps = {
  origin: string;
  tabId?: string;
  /**
   * @description if embedHtml provided, dappOrigin would be ignored
   */
  embedHtml?: string;
  url?: string;
  webviewProps?: React.ComponentProps<typeof WebView>;
  webviewContainerMaxHeight?: number;
  style?: StyleProp<ViewStyle>;
  isActive?: boolean;
  onSelfClose?: (reason: 'phishing') => void;
  tabsCount?: number;
  onUpdateTab?: (params: Partial<Tab>) => void;
  onOpenTab?(url: string): void;
  onUpdateHistory?: (params: { url: string; name?: string }) => void;
  onCloseTab?(url: string): void;
};

const TabWebView = React.forwardRef<
  WebView,
  BrowserTabProps['webviewProps'] & object
>((props, ref) => {
  const firstOnLoadStartRef = useRef(false);
  return (
    <TabWebView
      {...props}
      ref={ref}
      {...(IS_ANDROID &&
        !firstOnLoadStartRef.current && {
          onLoadStart: evt => {
            if (!firstOnLoadStartRef.current) {
              evt = {
                ...evt,
                nativeEvent: {
                  ...evt.nativeEvent,
                  isReload: true,
                },
              };
              firstOnLoadStartRef.current = true;
            }

            props.onLoadStart?.(evt);
          },
        })}
    />
  );
});

export type BrowserRef = {
  getWebViewDappOrigin: () => string;
  getWebViewId: () => string;
  getWebViewState: () => WebViewState;
  getWebViewActions: () => WebViewActions;
  getTabId: () => string;
  navigateTo: (url: string) => void;
};
export const BrowserTab = React.forwardRef<BrowserRef, BrowserTabProps>(
  (
    {
      origin,
      tabId,
      embedHtml,
      url,
      webviewProps,
      webviewContainerMaxHeight = Dimensions.get('screen').height,
      style,
      tabsCount,
      onUpdateTab,
      onOpenTab,
      onCloseTab,
      onUpdateHistory,
      isActive,
    },
    ref,
  ) => {
    const { styles } = useTheme2024({
      getStyle: getStyles,
    });
    const { t } = useTranslation();

    const isEmptyTab = !url;
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const { browserState, setPartialBrowserState } = useBrowser();
    const debounceProgress = useDebounce(progress, { wait: 500 });
    const [, setBrowserActiveTabState] = useBrowserActiveTabState();

    const {
      webviewRef,
      webviewIdRef,
      urlRef,
      titleRef,
      iconRef,

      webviewState,
      setWebViewState,

      webviewActions,
    } = useWebViewControl({ initialTabId: tabId });
    const [contentMode, setContentMode] =
      useState<WebViewProps['contentMode']>('mobile');

    // const navigation = useRabbyAppNavigation();
    const { dapps, disconnectDapp, setDapp } = useDapps();
    const { bookmarkStore, addBookmark, removeBookmark } = useBrowserBookmark();

    const urlInfo = useMemo(() => {
      return canoicalizeDappUrl(webviewState.resolvedUrl);
    }, [webviewState.resolvedUrl]);

    const dappInfo = useMemo(() => {
      return dapps[urlInfo.origin];
    }, [dapps, urlInfo.origin]);

    const handleDisconnect = useMemoizedFn(() => {
      disconnectDapp(urlInfo.origin);
    });

    const handleContentModeChange = useMemoizedFn(
      (mode: WebViewProps['contentMode']) => {
        onUpdateTab?.({
          initialUrl: webviewState.resolvedUrl,
        });
        setContentMode(mode);
      },
    );

    const handleClearCache = useMemoizedFn(async () => {
      webviewRef.current?.injectJavaScript(`;(function() {
        try {
          document.cookie.split(';').forEach(cookie => {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
          });
          localStorage.clear();
          sessionStorage.clear();
        } catch(e) {
          console.log('clear cache error', e);
        }
      })();`);
      setTimeout(() => {
        setRefreshKey(prev => prev + 1);
        toast.success(t('page.browser.toast.clearCacheSuccess'));
      }, 50);
    });

    const userAgent = useMemo(() => {
      if (contentMode === 'desktop') {
        return `${DESKTOP_MODE_UA} ${APP_UA_PARIALS.UA_FULL_NAME}}`;
      }
      return `${
        Platform.OS === 'android' ? USER_AGENT.ANDROID : USER_AGENT.IOS
      } ${APP_UA_PARIALS.UA_FULL_NAME}`;
    }, [contentMode]);

    const changeViewPortForDesktop = useCallback(
      (contentMode: WebViewProps['contentMode'], delayMs = 0) => {
        if (contentMode !== 'desktop') {
          return;
        }
        if (!IS_ANDROID) {
          return;
        }

        const change = () => {
          const screenWidth = Dimensions.get('screen').width;
          const pageWidth = Math.max(screenWidth, 1440); // Ensure at least 1440px width
          const initScale = coerceInteger(screenWidth / pageWidth, 1);

          webviewRef.current?.injectJavaScript(
            `;(function() {
            document.querySelector('meta[name=\"viewport\"]')?.remove();
            var viewport = document.createElement('meta');
            viewport.name = 'viewport';
            // var pageWidth = document.documentElement.clientWidth || document.body.clientWidth;
            // console.log('pageWidth', pageWidth);
            // viewport.content = 'width=' + pageWidth + ', initial-scale=1.0';
            viewport.content = 'width=${pageWidth}, initial-scale=${initScale}';
            document.head.appendChild(viewport);
          })();`,
          );
        };

        if (delayMs > 0) {
          setTimeout(change, delayMs);
        } else {
          change();
        }
      },
      [webviewRef],
    );

    const isBookmark = useMemo(() => {
      return !!bookmarkStore.ids.find(
        url => safeGetOrigin(url) === safeGetOrigin(webviewState.resolvedUrl),
      );
    }, [bookmarkStore.ids, webviewState.resolvedUrl]);

    const handleBookmark = useMemoizedFn(() => {
      if (isBookmark) {
        removeBookmark(webviewState.resolvedUrl);
      } else {
        addBookmark({
          url: webviewState.resolvedUrl,
          name: webviewState.title,
          createdAt: Date.now(),
        });
        matomoRequestEvent({
          category: 'Websites Usage',
          action: 'Website_Favorite',
          label: safeGetOrigin(webviewState.resolvedUrl),
        });
      }
    });

    const viewShotRef = useRef<ViewShot | null>(null);

    const { entryScriptWeb3Loaded, fullScript } =
      useJavaScriptBeforeContentLoaded();

    const { onLoadStart, onMessage: onWebViewMessage } = useSetupWebview({
      dappOrigin: origin,
      webviewRef,
      webviewIdRef,
      siteInfoRefs: {
        urlRef,
        titleRef,
        iconRef,
      },
      // onSelfClose,
    });

    const handleGoTo = useMemoizedFn(async (urlToGo: string) => {
      if (!urlToGo || !/^https?:\/\//.test(urlToGo)) {
        return;
      }
      webviewRef.current?.stopLoading();
      setWebViewState(prev => ({ ...prev, resolvedUrl: urlToGo }));
      if (isEmptyTab) {
        await sleep(200);
        await handleViewShot();
        onOpenTab?.(urlToGo);
      } else {
        webviewRef?.current?.injectJavaScript(
          `window.location.href = '${urlUtils.sanitizeUrlInput(urlToGo)}';
          true; // Required for iOS
        `,
        );
      }
      setIsLoading(true);
      setProgress(0.1);
    });

    const handleSearch = useMemoizedFn((search: string) => {
      if (!search?.trim()) {
        return;
      }
      const parsedUrl = parsePossibleURL(search);
      if (parsedUrl) {
        handleGoTo(parsedUrl);
      } else {
        handleSearchGoogle(search);
      }
    });

    const handleSearchGoogle = useMemoizedFn((search: string) => {
      handleGoTo(
        `https://www.google.com/search?q=${encodeURIComponent(search)}`,
      );
    });

    const handleViewShot = useMemoizedFn(async () => {
      try {
        const viewShot = await viewShotRef.current?.capture?.();
        if (!viewShot || !tabId) {
          return;
        }
        const fileName = await browserService.saveScreenshot({
          tempUri: viewShot,
          tabId,
        });
        onUpdateTab?.({
          viewShot: fileName,
        });
      } catch (e) {
        console.error('viewShot', e);
      }
    });

    const handleGoBack = useMemoizedFn(() => {
      webviewRef.current?.goBack();
    });

    const handleGoForward = useMemoizedFn(() => {
      webviewRef.current?.goForward();
    });

    const handleReload = useMemoizedFn(() => {
      handleGoTo(webviewState.resolvedUrl);
      // // todo some times not work
      // if (Platform.OS === 'android') {
      //   webviewRef.current?.injectJavaScript(`(function(){
      //     window.location.reload();
      //   })()`);
      // } else {
      //   webviewRef.current?.reload();
      // }
    });

    const handleOpenInBrowser = useMemoizedFn(() => {
      Linking.openURL(webviewState.resolvedUrl);
    });

    const handleViewTabs = useMemoizedFn(async () => {
      if (isActive && debounceProgress === 1) {
        await handleViewShot();
      }

      setPartialBrowserState({
        isShowManage: true,
      });

      // navigation.navigateDeprecated(RootNames.StackBrowser, {
      //   screen: RootNames.BrowserManageScreen,
      // });
    });

    const handleGoHome = useMemoizedFn(async () => {
      if (isActive && debounceProgress === 1) {
        await handleViewShot();
      }
      setPartialBrowserState({
        isShowBrowser: false,
      });

      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_Exit',
        label: 'Click Home',
      });
    });

    const handleOnOpenWindow = useMemoizedFn(
      (syntheticEvent: { nativeEvent: { targetUrl: string } }) => {
        const { nativeEvent } = syntheticEvent;
        const { targetUrl } = nativeEvent;
        if (!targetUrl) {
          return;
        }

        const isDeeplink = !targetUrl.startsWith('http');

        if (isValidAppStoreUrl(targetUrl) && isDeeplink) {
          Linking.openURL(targetUrl).catch(error => {
            console.warn('Failed to open deeplink', { url, error });
          });
          return;
        }

        const currentUrl = webviewState.url;
        if (currentUrl === targetUrl) {
          return;
        }

        onOpenTab?.(targetUrl);
      },
    );

    const renderError = useMemoizedFn(
      (
        errorDomain: string | undefined,
        errorCode: number,
        errorDesc: string,
      ) => {
        return (
          <WebviewError
            code={errorCode}
            message={errorDesc}
            onRefresh={handleReload}
            onOpenInBrowser={handleOpenInBrowser}
          />
        );
      },
    );

    useEffect(() => {
      if (isActive && debounceProgress === 1) {
        handleViewShot();
      }
    }, [debounceProgress, handleViewShot, isActive]);

    useEffect(() => {
      if (!browserState.isShowBrowser || browserState.isShowSearch) {
        return;
      }
      const origin = urlInfo?.origin;
      if (isActive && origin && dappService.getDapp(origin)?.isConnected) {
        matomoRequestEvent({
          category: 'Websites Usage',
          action: 'Website_Connected',
          label: origin,
        });
      }
    }, [
      browserState.isShowBrowser,
      browserState.isShowSearch,
      isActive,
      urlInfo?.origin,
    ]);

    React.useImperativeHandle(
      ref,
      () => ({
        getWebViewDappOrigin: () => origin,
        getWebViewId: () => webviewIdRef.current || '',
        getWebViewState: () => webviewState,
        getWebViewActions: () => webviewActions,
        getTabId: () => tabId || '',
        navigateTo: handleGoTo,
      }),
      [handleGoTo, origin, webviewIdRef, webviewState, webviewActions, tabId],
    );

    const handleUpdateTab = useMemoizedFn((params: Partial<Tab>) => {
      return onUpdateTab?.(params);
    });

    useEffect(() => {
      if (!isActive && !isEmptyTab) {
        const id = setTimeout(() => {
          handleUpdateTab?.({
            initialUrl: urlRef.current ? urlRef.current : undefined,
            isTerminate: true,
          });
        }, 15 * 60 * 1000);

        return () => {
          clearTimeout(id);
        };
      }
    }, [handleUpdateTab, isActive, isEmptyTab, urlRef]);

    useEffect(() => {
      if (dappInfo?.isDapp) {
        handleUpdateTab({
          isDapp: true,
        });
      }
    }, [dappInfo?.isDapp, handleUpdateTab]);

    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
      if (!webviewState.resolvedUrl && url) {
        setWebViewState(prev => {
          return {
            ...prev,
            resolvedUrl: url,
          };
        });
      }
    }, [setWebViewState, url, webviewState.resolvedUrl]);

    useEffect(() => {
      if (isActive) {
        setBrowserActiveTabState({
          url: webviewState.url,
          contentMode: contentMode,
          isConnected: dappInfo?.isConnected,
          isBookmark: isBookmark,
          isDapp: dappInfo?.isDapp,
        });
      }
    }, [
      contentMode,
      dappInfo?.isConnected,
      dappInfo?.isDapp,
      isActive,
      isBookmark,
      setBrowserActiveTabState,
      webviewState.url,
    ]);

    const handleAction = useMemoizedFn(
      (payload: {
        type: 'refresh' | 'disconnect' | 'favorite' | 'contentMode';
      }) => {
        if (payload?.type === 'refresh') {
          handleReload();
        } else if (payload?.type === 'disconnect') {
          handleDisconnect();
        } else if (payload.type === 'favorite') {
          handleBookmark();
        } else if (payload.type === 'contentMode') {
          handleContentModeChange(
            contentMode === 'desktop' ? 'mobile' : 'desktop',
          );
        } else if (payload.type === 'clearCache') {
          handleClearCache();
        }
      },
    );
    useEffect(() => {
      if (isActive) {
        eventBus.on(EVENT_BROWSER_ACTION, handleAction);
      } else {
        eventBus.removeListener(EVENT_BROWSER_ACTION, handleAction);
      }
      return () => {
        eventBus.removeListener(EVENT_BROWSER_ACTION, handleAction);
      };
    }, [handleAction, isActive]);

    const { isShowInvite, setIsShowInvite, handleInvite } =
      useHyperliquidReferral({
        url: webviewState.resolvedUrl,
        account: dappInfo?.isConnected ? dappInfo?.currentAccount : null,
      });

    const {
      isShowInvite: isShowAsterInvite,
      setIsShowInvite: setIsShowAsterInvite,
    } = useAsterReferral({
      url: webviewState.resolvedUrl,
      connectedAddress: dappInfo?.isConnected
        ? dappInfo?.currentAccount?.address
        : null,
    });

    const [isShowAccountPopup, setIsShowAccountPopup] = useState(false);
    const [isShowCurrentDappPopup, setIsShowCurrentDappPopup] = useState(false);

    useEffect(() => {
      if (!dappInfo?.isConnected) {
        setIsShowCurrentDappPopup(false);
      }
    }, [dappInfo?.isConnected]);

    const { accounts } = useAccounts({
      disableAutoFetch: true,
    });
    const account = useMemo(() => {
      return getDappAccount({ dappInfo, accounts });
    }, [accounts, dappInfo, browserState.isShowBrowser]);

    return (
      <Freeze freeze={!isActive}>
        <View style={[style, styles.dappWebViewControl]}>
          <ViewShot
            ref={viewShotRef}
            style={styles.viewShot}
            options={{
              format: 'jpg',
              quality: 0.2,
            }}>
            <NativeViewGestureHandler disallowInterruption={true}>
              <View
                // renderToHardwareTextureAndroid
                style={[
                  styles.dappWebViewContainer,
                  !webviewContainerMaxHeight
                    ? {}
                    : {
                        maxHeight: webviewContainerMaxHeight,
                      },
                ]}>
                {!url ||
                !/^https?:\/\//.test(url) ||
                !entryScriptWeb3Loaded ? null : (
                  <>
                    {isLoading ? (
                      <BrowserProgressBar
                        progress={progress}
                        style={styles.progressBar}
                      />
                    ) : null}
                    <WebView
                      key={`${refreshKey}-${contentMode}`}
                      cacheEnabled
                      startInLoadingState={false}
                      renderLoading={() => <View style={styles.hidden} />}
                      allowsFullscreenVideo={false}
                      allowsInlineMediaPlayback={false}
                      originWhitelist={['*']}
                      pullToRefreshEnabled={true}
                      {...webviewProps}
                      style={[styles.dappWebView, webviewProps?.style]}
                      ref={webviewRef}
                      source={{
                        ...(embedHtml
                          ? {
                              html: embedHtml,
                            }
                          : {
                              uri: url!,
                            }),
                        // TODO: cusotmize userAgent here
                        // 'User-Agent': ''
                      }}
                      testID={'RABBY_DAPP_WEBVIEW_ANDROID_CONTAINER'}
                      userAgent={userAgent}
                      // applicationNameForUserAgent={APP_UA_PARIALS.UA_FULL_NAME}
                      javaScriptEnabled
                      // androidLayerType='software'
                      injectedJavaScriptBeforeContentLoaded={fullScript}
                      injectedJavaScriptBeforeContentLoadedForMainFrameOnly={
                        true
                      }
                      {...(IS_ANDROID && {
                        injectedJavaScript: PATCH_ANCHOR_TARGET,
                      })}
                      onNavigationStateChange={event => {
                        // onUpdateTab?.({
                        //   url: event.url,
                        //   name: event.title,
                        // });
                        return webviewActions.onNavigationStateChange(event);
                      }}
                      // onOpenWindow={handleOnOpenWindow}
                      webviewDebuggingEnabled={isNonPublicProductionEnv}
                      contentMode={contentMode}
                      {...(contentMode === 'desktop' && {
                        scalesPageToFit: true,
                      })}
                      onLoadStart={e => {
                        const alwaysTreatReloadAsTrue =
                          IS_ANDROID &&
                          !!getOnlineConfig()?.switches?.[
                            '20250924.android_webview_always_treat_as_reload'
                          ];

                        let treatAsReload =
                          IS_IOS ||
                          e.nativeEvent.isReload ||
                          alwaysTreatReloadAsTrue;

                        if (!treatAsReload) {
                          const eventUrlOrigin = urlUtils.canoicalizeDappUrl(
                            e.nativeEvent.url,
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

                        webviewProps?.onLoadStart?.(e);
                        onLoadStart(e, treatAsReload);
                        if (treatAsReload) {
                          setIsLoading(true);
                          setProgress(0);
                        }
                        const { nativeEvent } = e;

                        if (
                          nativeEvent.url !== urlRef.current &&
                          nativeEvent.loading &&
                          nativeEvent.navigationType === 'backforward'
                        ) {
                          onUpdateTab?.({
                            url: nativeEvent.url,
                            // name: nativeEvent.title,
                          });
                          onUpdateHistory?.({
                            name: nativeEvent.title,
                            url: nativeEvent.url,
                          });
                        }
                      }}
                      onLoadProgress={({ nativeEvent }) => {
                        setProgress(nativeEvent.progress);
                        if (nativeEvent.progress === 1) {
                          setIsLoading(false);
                        }
                      }}
                      onLoad={e => {
                        changeViewPortForDesktop(contentMode, 0);
                      }}
                      onLoadEnd={e => {
                        if (!e.nativeEvent.loading) {
                          setIsLoading(false);
                        }
                        webviewProps?.onLoadEnd?.(e);
                        const { nativeEvent } = e;
                        // if (nativeEvent.loading) {
                        //   return;
                        // }
                        onUpdateTab?.({
                          url: nativeEvent.url,
                          // name: nativeEvent.title,
                        });
                        setWebViewState(prev => {
                          return {
                            ...prev,
                            resolvedUrl: nativeEvent.url,
                          };
                        });

                        onUpdateHistory?.({
                          name: nativeEvent.title,
                          url: nativeEvent.url,
                        });
                        // if (
                        //   isActive &&
                        //   browserState.isShowBrowser &&
                        //   !browserState.isShowSearch &&
                        //   !browserState.isShowManage
                        // ) {
                        //   setTimeout(() => {
                        //     handleViewShot(nativeEvent.url);
                        //   }, 200);
                        // }
                      }}
                      onFileDownload={e => {
                        Linking.openURL(e.nativeEvent.downloadUrl);
                      }}
                      onShouldStartLoadWithRequest={nativeEvent => {
                        const origin = safeGetOrigin(nativeEvent.url);
                        if (
                          isGoogle(webviewState.resolvedUrl) &&
                          dappService.getDapp(origin)?.isDapp &&
                          origin
                        ) {
                          matomoRequestEvent({
                            category: 'Websites Usage',
                            action: 'Website_Visit_Page Link',
                            label: origin,
                          });
                        }
                        return checkShouldStartLoadingWithRequestForDappWebView(
                          nativeEvent,
                        );
                      }}
                      onContentProcessDidTerminate={syntheticEvent => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn(
                          'IOS Content process terminated',
                          nativeEvent,
                        );

                        if (isActive) {
                          // handleReload();
                          setRefreshKey(key => key + 1);
                        } else {
                          onUpdateTab?.({
                            initialUrl: nativeEvent.url,
                            url: nativeEvent.url,
                            isTerminate: true,
                          });
                        }
                      }}
                      onRenderProcessGone={syntheticEvent => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn(
                          'Android Content process terminated',
                          nativeEvent,
                        );

                        if (isActive) {
                          // handleReload();
                          setRefreshKey(key => key + 1);
                        } else {
                          onUpdateTab?.({
                            initialUrl: webviewState.resolvedUrl,
                            url: webviewState.resolvedUrl,
                            isTerminate: true,
                          });
                        }
                      }}
                      // onError={errorLog}
                      onError={e => {
                        // // leave here for debug
                        // if (__DEV__) {
                        //   console.warn('WebView:: onError event', e);
                        // }
                        setWebViewState(prev => {
                          return {
                            ...prev,
                            resolvedUrl: e.nativeEvent.url,
                          };
                        });
                      }}
                      renderError={renderError}
                      onMessage={event => {
                        // // leave here for debug
                        // if (__DEV__) {
                        //   console.log('WebView:: onMessage event', event);
                        // }
                        onWebViewMessage(event);
                        webviewProps?.onMessage?.(event);

                        // // leave here for debug
                        // webviewRef.current?.injectJavaScript(
                        //   JS_POST_MESSAGE_TO_PROVIDER(
                        //     JSON.stringify({
                        //       type: 'hello',
                        //       data: 'I have received your message!',
                        //     }),
                        //     '*',
                        //   ),
                        // );
                      }}
                    />
                  </>
                )}
              </View>
            </NativeViewGestureHandler>
          </ViewShot>
          {isActive && !browserState.isShowSearch ? (
            <View
              style={styles.dappWebViewNavControl}
              key={browserState.isShowBrowser ? 'show' : 'hide'}>
              <BrowserHeader
                dapp={dappInfo}
                url={webviewState.resolvedUrl}
                onViewTabs={handleViewTabs}
                onLocationBarPress={str => {
                  setPartialBrowserState({
                    isShowSearch: true,
                    searchText: str,
                    searchTabId: tabId,
                    trigger: 'browser',
                  });
                }}
                account={account}
                tabsCount={tabsCount}
                canGoBack={webviewState.canGoBack}
                onGoBack={handleGoBack}
                onGoHome={handleGoHome}
                onAccountPress={() => {
                  if (dappInfo?.isConnected) {
                    setIsShowCurrentDappPopup(true);
                  } else {
                    setIsShowAccountPopup(true);
                  }
                }}
              />
              {/* <BrowserFooter
              url={webviewState.resolvedUrl}
              onGoHome={handleGoHome}
              canReload={!isEmptyTab}
              onReload={handleReload}
              canGoBack={webviewState.canGoBack}
              onGoBack={handleGoBack}
              canGoForward={webviewState.canGoForward}
              onGoForward={handleGoForward}
              tabsCount={tabsCount}
              onViewTabs={handleViewTabs}
              isBookmark={!!isBookmark}
              isConnected={dappInfo?.isConnected}
              isDapp={dappInfo?.isDapp}
              onBookmark={handleBookmark}
              onDisconnect={handleDisconnect}
              contentMode={contentMode}
              onContentModeChange={handleContentModeChange}
              canViewMore={!!url}
            /> */}
            </View>
          ) : null}
          {safeGetOrigin(webviewState.resolvedUrl) ===
            safeGetOrigin(PERPS_INVITE_URL) && dappInfo?.isConnected ? (
            <PerpsInvitePopup
              visible={
                isShowInvite &&
                isActive &&
                !browserState.isShowSearch &&
                browserState.isShowBrowser &&
                !isShowAccountPopup &&
                !isShowCurrentDappPopup
              }
              onClose={() => {
                setIsShowInvite(false);
                perpsService.setInviteConfig(account?.address || '', {
                  lastConnectedAt: Date.now(),
                });
              }}
              onInvite={async () => {
                try {
                  await handleInvite();
                  perpsService.setInviteConfig(account?.address || '', {
                    lastConnectedAt: Date.now(),
                  });
                  setIsShowInvite(false);
                } catch (e) {
                  console.error('Hyperliquid invite error', e);
                  throw e;
                }
              }}
              footer={
                <View style={styles.dappWebViewNavControl}>
                  <BrowserHeader
                    dapp={dappInfo}
                    url={webviewState.resolvedUrl}
                    onViewTabs={handleViewTabs}
                    onLocationBarPress={str => {
                      setPartialBrowserState({
                        isShowSearch: true,
                        searchText: str,
                        searchTabId: tabId,
                        trigger: 'browser',
                      });
                    }}
                    account={account}
                    tabsCount={tabsCount}
                    canGoBack={webviewState.canGoBack}
                    onGoBack={handleGoBack}
                    onGoHome={handleGoHome}
                    onAccountPress={() => {
                      if (dappInfo?.isConnected) {
                        setIsShowCurrentDappPopup(true);
                      } else {
                        setIsShowAccountPopup(true);
                      }
                    }}
                  />
                </View>
              }
            />
          ) : null}
          {safeGetOrigin(webviewState.resolvedUrl) ===
            safeGetOrigin(PERPS_ASTER_INVITE_URL) && dappInfo?.isConnected ? (
            <AsterPerpsInvitePopup
              type="aster"
              visible={
                isShowAsterInvite &&
                isActive &&
                !browserState.isShowSearch &&
                browserState.isShowBrowser &&
                !isShowAccountPopup &&
                !isShowCurrentDappPopup
              }
              onClose={() => {
                setIsShowAsterInvite(false);
                preferenceService.setHasShowAsterPopup(true);
              }}
              onInvite={() => {
                handleGoTo(PERPS_ASTER_INVITE_URL);
                setIsShowAsterInvite(false);
                preferenceService.setHasShowAsterPopup(true);
              }}
              footer={
                <View style={styles.dappWebViewNavControl}>
                  <BrowserHeader
                    dapp={dappInfo}
                    url={webviewState.resolvedUrl}
                    onViewTabs={handleViewTabs}
                    onLocationBarPress={str => {
                      setPartialBrowserState({
                        isShowSearch: true,
                        searchText: str,
                        searchTabId: tabId,
                        trigger: 'browser',
                      });
                    }}
                    account={account}
                    tabsCount={tabsCount}
                    canGoBack={webviewState.canGoBack}
                    onGoBack={handleGoBack}
                    onGoHome={handleGoHome}
                    onAccountPress={() => {
                      if (dappInfo?.isConnected) {
                        setIsShowCurrentDappPopup(true);
                      } else {
                        setIsShowAccountPopup(true);
                      }
                    }}
                  />
                </View>
              }
            />
          ) : null}
          {dappInfo ? (
            <>
              <CurrentDappPopup
                visible={isShowCurrentDappPopup}
                onClose={() => {
                  setIsShowCurrentDappPopup(false);
                }}
                account={account}
                dapp={dappInfo}
              />
              <AccountSelectorPopup
                visible={isShowAccountPopup}
                onClose={() => {
                  setIsShowAccountPopup(false);
                }}
                value={account}
                onChange={v => {
                  dappService.updateDapp({
                    ...dappInfo,
                    currentAccount: v,
                  });
                  setIsShowAccountPopup(false);
                }}
              />
            </>
          ) : null}
        </View>
      </Freeze>
    );
  },
);

const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    dappWebViewControl: {
      position: 'relative',
      // don't put backgroundColor here to avoid cover the background on BottomSheetModal
      backgroundColor: 'transparent',
      width: '100%',
      height: '100%',
    },
    viewShot: {
      flex: 1,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
    },
    dappWebViewHeadContainer: {
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      maxWidth: Dimensions.get('window').width,
      height: ScreenLayouts2.dappWebViewControlHeaderHeight,
      paddingHorizontal: 20,
      paddingVertical: 0,
      // paddingTop: 10,
      backgroundColor: ctx.colors['neutral-bg-1'],
      // ...makeDebugBorder('red'),
    },
    flexShrink0: {
      flexShrink: 0,
    },
    touchableHeadWrapper: {
      height: ScreenLayouts2.dappWebViewControlHeaderHeight,
      justifyContent: 'center',
      flexShrink: 0,
    },
    closeDappIcon: {
      color: ctx.colors2024['neutral-title-1'],
    },
    DappWebViewHeadTitleWrapper: {
      flexShrink: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      ...(Platform.OS === 'android' && {
        width: '100%',
      }),
    },
    HeadTitleOrigin: {
      fontSize: 20,
      fontFamily: FontNames.sf_pro_rounded_bold,
      fontWeight: '800',
      textAlign: 'center',
      color: ctx.colors['neutral-title-1'],
      lineHeight: 24,
    },
    HeadTitleFull: {
      textAlign: 'center',
      maxWidth: '90%',
      color: ctx.colors['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: 24,
    },

    dappWebViewContainer: {
      flexShrink: 1,
      flex: 1,
      height: '100%',
      // ...makeDebugBorder('green')
      position: 'relative',
    },
    dappWebView: {
      flex: 1,
      height: '100%',
      // maxHeight:
      //   Dimensions.get('window').height -
      //   ScreenLayouts2.dappWebViewControlHeaderHeight -
      //   ScreenLayouts2.TabbedDappWebViewControlNavHeight,
      width: '100%',
      opacity: 0.99,
      overflow: 'hidden',
    },
    dappWebViewNavControl: {
      flexShrink: 0,
      flexGrow: 0,
      // height: ScreenLayouts2.dappWebViewControlNavHeight,
      // height: 124,
      // height: ScreenLayouts2.TabbedDappWebViewControlNavHeightV2,
      paddingBottom: Platform.OS === 'android' ? 0 : 20,
      // backgroundColor: ctx.colors['neutral-bg-1'],
      // ...makeDebugBorder(),
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      ...Platform.select({
        ios: {
          shadowColor: 'rgba(55, 56, 63, 0.12)',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 1,
          shadowRadius: 40 / 2,
        },
      }),
    },
    progressBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 10,
    },
    hidden: {
      display: 'none',
    },
  }),
);
