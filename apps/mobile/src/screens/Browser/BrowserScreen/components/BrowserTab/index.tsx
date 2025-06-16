import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import WebView, { WebViewProps } from 'react-native-webview';

import { RootNames, ScreenLayouts2 } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import AutoLockView from '@/components/AutoLockView';
import {
  useWebViewControl,
  WebViewActions,
  WebViewState,
} from '@/components/WebView/hooks';
import { checkShouldStartLoadingWithRequestForDappWebView } from '@/components/WebView/utils';
import { APP_UA_PARIALS } from '@/constant';
import { ANDROID_DESKTOP_MODE_UA } from '@/constant/browser';
import { parsePossibleURL } from '@/constant/dappView';
import { PATCH_ANCHOR_TARGET } from '@/core/bridges/builtInScripts/patchAnchor';
import { useSetupWebview } from '@/core/bridges/useBackgroundBridge';
import { IS_ANDROID } from '@/core/native/utils';
import { browserService } from '@/core/services';
import { FontNames } from '@/core/utils/fonts';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import { useDapps } from '@/hooks/useDapps';
import { sleep } from '@/utils/async';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useFocusEffect } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import ViewShot from 'react-native-view-shot';
import { BrowserBookmarkSection } from '../BrowserBookmarkSection';
import { BrowserFooter } from './BrowserFooter';
import { BrowserHeader } from './BrowserHeader';
import { BrowserProgressBar } from './BrowserProgressBar';
import { BrowserSearchAutoComplete } from './BrowserSearchAutoComplete';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { emptyTab } from '@/core/services/browserService';
import { coerceInteger } from '@/utils/number';

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
  onUpdateTab?: (params: {
    initialUrl?: string;
    url?: string;
    viewShot?: string;
    name?: string;
    isTerminate?: boolean;
  }) => void;
  onOpenTab?(url: string): void;
  onUpdateHistory?: (params: { url: string; name?: string }) => void;
};

export type BrowserRef = {
  getWebViewDappOrigin: () => string;
  getWebViewId: () => string;
  getWebViewState: () => WebViewState;
  getWebViewActions: () => WebViewActions;
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
      onUpdateHistory,
      isActive,
    },
    ref,
  ) => {
    const { styles, colors, colors2024 } = useTheme2024({
      getStyle: getStyles,
    });

    const isEmptyTab = !url;
    const [isShowSearch, setIsShowSearch] = useState(isActive && isEmptyTab);
    const [searchText, setSearchText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const { switchToTab } = useBrowser();

    const {
      webviewRef,
      webviewIdRef,
      urlRef,
      titleRef,
      iconRef,

      webviewState,

      webviewActions,
    } = useWebViewControl({ initialTabId: tabId });
    const [contentMode, setContentMode] =
      useState<WebViewProps['contentMode']>('mobile');
    const [userAgent, setUserAgent] = useState<string>();

    const navigation = useRabbyAppNavigation();
    const { dapps, disconnectDapp, setDapp } = useDapps();
    const { bookmarkStore, addBookmark, removeBookmark } = useBrowserBookmark();

    const urlInfo = useMemo(() => {
      return canoicalizeDappUrl(webviewState.url);
    }, [webviewState.url]);

    const dappInfo = useMemo(() => {
      return dapps[urlInfo.origin];
    }, [dapps, urlInfo.origin]);

    const handleDisconnect = useMemoizedFn(() => {
      disconnectDapp(urlInfo.origin);
    });

    const handleContentModeChange = useMemoizedFn(
      (mode: WebViewProps['contentMode']) => {
        onUpdateTab?.({
          initialUrl: webviewState.url,
        });
        setContentMode(mode);
        if (Platform.OS === 'android') {
          if (mode === 'desktop') {
            setUserAgent(ANDROID_DESKTOP_MODE_UA);
          } else {
            setUserAgent(browserService.getDefaultUserAgent());
          }
        }
      },
    );

    const changeViewPortForDesktop = useCallback(
      (contentMode: WebViewProps['contentMode'], delayMs = 0) => {
        if (contentMode !== 'desktop') return;
        if (!IS_ANDROID) return;

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
      return !!bookmarkStore.entities[webviewState.url];
    }, [bookmarkStore.entities, webviewState.url]);

    const handleBookmark = useMemoizedFn(() => {
      if (isBookmark) {
        removeBookmark(webviewState.url);
      } else {
        addBookmark({
          url: webviewState.url,
          name: webviewState.title,
          createdAt: Date.now(),
        });
      }
    });

    const viewShotRef = useRef<any>(null);

    const { entryScriptWeb3Loaded, fullScript } =
      useJavaScriptBeforeContentLoaded({ isTop: false });

    React.useImperativeHandle(
      ref,
      () => ({
        getWebViewDappOrigin: () => origin,
        getWebViewId: () => webviewIdRef.current || '',
        getWebViewState: () => webviewState,
        getWebViewActions: () => webviewActions,
      }),
      [origin, webviewIdRef, webviewState, webviewActions],
    );

    const { onLoadStart, onMessage: onBridgeMessage } = useSetupWebview({
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
      if (isEmptyTab) {
        setIsShowSearch(false);
        await sleep(200);
        await handleViewShot('');
        onOpenTab?.(urlToGo);
      } else {
        webviewRef?.current?.injectJavaScript(
          `(function(){window.location.href = '${urlUtils.sanitizeUrlInput(
            urlToGo,
          )}' })()`,
        );
      }
      setIsLoading(true);
      setProgress(0.1);
      setIsShowSearch(false);
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
      setSearchText('');
    });

    const handleViewShot = useMemoizedFn(async (url: string) => {
      try {
        const viewShot = await viewShotRef.current?.capture();
        onUpdateTab?.({
          url: url,
          viewShot,
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
      // todo some times not work
      if (Platform.OS === 'android') {
        webviewRef.current?.injectJavaScript(`(function(){
          window.location.reload();
        })()`);
      } else {
        webviewRef.current?.reload();
      }
    });

    const handleViewTabs = useMemoizedFn(async () => {
      await handleViewShot(webviewState.url);
      navigation.navigate(RootNames.StackBrowser, {
        screen: RootNames.BrowserManageScreen,
      });
    });

    const handleGoHome = useMemoizedFn(() => {
      switchToTab(emptyTab.id);
    });

    // useEffect(() => {
    //   if (isEmptyTab && isActive) {
    //     setTimeout(() => {
    //       handleViewShot('');
    //     }, 300);
    //   }
    // }, [handleViewShot, isActive, isEmptyTab, isShowSearch]);

    useEffect(() => {
      if (!isActive && !isEmptyTab) {
        const id = setTimeout(() => {
          onUpdateTab?.({
            initialUrl: urlRef.current ? urlRef.current : undefined,
            isTerminate: true,
          });
        }, 15 * 60 * 1000);

        return () => {
          clearTimeout(id);
        };
      }
    }, [isActive, isEmptyTab, onUpdateTab, urlRef]);

    useFocusEffect(
      React.useCallback(() => {
        if (isEmptyTab && isActive) {
          setTimeout(() => {
            setIsShowSearch(true);
          }, 100);
        }
        return () => {};
      }, [isActive, isEmptyTab]),
    );

    const [refreshKey, setRefreshKey] = useState(0);

    return (
      <AutoLockView style={[style, styles.dappWebViewControl]}>
        {isActive ? (
          <BrowserHeader
            dapp={dappInfo}
            url={webviewState.url}
            isFocused={isShowSearch}
            searchText={searchText}
            onSearchTextChange={setSearchText}
            onFocusChange={v => {
              setIsShowSearch(v);
            }}
            onSearch={handleSearch}
          />
        ) : null}

        {isShowSearch && searchText ? (
          <BrowserSearchAutoComplete
            text={searchText}
            onSelect={handleSearchGoogle}
          />
        ) : null}

        <ViewShot
          ref={viewShotRef}
          style={[
            { flex: 1, backgroundColor: colors2024['neutral-bg-1'] },
            isShowSearch && searchText ? styles.hidden : null,
          ]}
          options={{
            format: 'jpg',
            quality: 0.2,
            result: 'data-uri',
          }}>
          {(isShowSearch && !searchText) || (!isShowSearch && !url) ? (
            <BrowserBookmarkSection
              onPress={dapp => {
                const urlToGo = dapp.url || dapp.origin;
                handleGoTo(urlToGo);
              }}
            />
          ) : null}
          <View
            // renderToHardwareTextureAndroid
            style={[
              styles.dappWebViewContainer,
              isShowSearch && styles.hidden,
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
                  {...webviewProps}
                  style={[
                    styles.dappWebView,
                    webviewProps?.style,
                    isShowSearch ? styles.hidden : null,
                  ]}
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
                  applicationNameForUserAgent={APP_UA_PARIALS.UA_FULL_NAME}
                  javaScriptEnabled
                  // androidLayerType='software'
                  injectedJavaScriptBeforeContentLoaded={fullScript}
                  injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
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
                  webviewDebuggingEnabled={__DEV__}
                  contentMode={contentMode}
                  {...(contentMode === 'desktop' && {
                    scalesPageToFit: true,
                  })}
                  onLoadStart={e => {
                    webviewProps?.onLoadStart?.(e);
                    onLoadStart(e);
                    setIsLoading(true);
                    setProgress(0);
                    const { nativeEvent } = e;

                    if (
                      nativeEvent.url !== urlRef.current &&
                      nativeEvent.loading &&
                      nativeEvent.navigationType === 'backforward'
                    ) {
                      onUpdateTab?.({
                        url: nativeEvent.url,
                        name: nativeEvent.title,
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
                    setIsLoading(false);
                    webviewProps?.onLoadEnd?.(e);
                    const { nativeEvent } = e;
                    if (nativeEvent.loading) {
                      return;
                    }
                    onUpdateTab?.({
                      url: nativeEvent.url,
                      name: nativeEvent.title,
                    });
                    onUpdateHistory?.({
                      name: nativeEvent.title,
                      url: nativeEvent.url,
                    });
                    if (isActive) {
                      handleViewShot(nativeEvent.url);
                    }
                  }}
                  onShouldStartLoadWithRequest={nativeEvent => {
                    return checkShouldStartLoadingWithRequestForDappWebView(
                      nativeEvent,
                    );
                  }}
                  onContentProcessDidTerminate={syntheticEvent => {
                    const { nativeEvent } = syntheticEvent;
                    console.warn('IOS Content process terminated', nativeEvent);

                    if (isActive) {
                      handleReload();
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
                        initialUrl: webviewState.url,
                        url: webviewState.url,
                        isTerminate: true,
                      });
                    }
                  }}
                  // onError={errorLog}
                  onMessage={event => {
                    // // leave here for debug
                    // if (__DEV__) {
                    //   console.log('WebView:: onMessage event', event);
                    // }
                    onBridgeMessage(event);
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
        </ViewShot>
        {isShowSearch ? null : isActive ? (
          <View style={styles.dappWebViewNavControl}>
            <BrowserFooter
              url={webviewState.url}
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
              onBookmark={handleBookmark}
              onDisconnect={handleDisconnect}
              contentMode={contentMode}
              onContentModeChange={handleContentModeChange}
              canViewMore={!!url}
            />
          </View>
        ) : null}
      </AutoLockView>
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
      // ...makeDebugBorder('blue')
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
      //   ScreenLayouts2.dappWebViewControlNavHeight,
      width: '100%',
      opacity: 0.99,
      overflow: 'hidden',
    },
    dappWebViewNavControl: {
      flexShrink: 0,
      height: ScreenLayouts2.dappWebViewControlNavHeight,
      backgroundColor: ctx.colors['neutral-bg-1'],
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
