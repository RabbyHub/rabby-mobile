import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import WebView from 'react-native-webview';

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
import { PATCH_ANCHOR_TARGET } from '@/core/bridges/builtInScripts/patchAnchor';
import { useSetupWebview } from '@/core/bridges/useBackgroundBridge';
import { IS_ANDROID } from '@/core/native/utils';
import { FontNames } from '@/core/utils/fonts';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import { createGetStyles2024 } from '@/utils/styles';
import { TabActions } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import { BrowserFooter } from './BrowserFooter';
import { BrowserHeader } from './BrowserHeader';
import { DappFavoriteSection } from '@/screens/Browser/DappFavoriteSection';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useMemoizedFn, useSetState } from 'ahooks';
import { BrowserBookmarkSection } from '../BrowserBookmarkSection';
import { BrowserProgressBar } from './BrowserProgressBar';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useDapps } from '@/hooks/useDapps';

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
  onSelfClose?: (reason: 'phishing') => void;
  tabsCount?: number;
  onUpdateTab?: (params: {
    url: string;
    viewShot?: string;
    name?: string;
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
    },
    ref,
  ) => {
    const { styles, colors, colors2024 } = useTheme2024({
      getStyle: getStyles,
    });

    const [isShowSearch, setIsShowSearch] = useState(!url);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const {
      webviewRef,
      webviewIdRef,
      urlRef,
      titleRef,
      iconRef,

      webviewState,

      webviewActions,
    } = useWebViewControl({ initialTabId: tabId });

    const navigation = useRabbyAppNavigation();
    const { dapps, disconnectDapp } = useDapps();
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

    const handleGoTo = useMemoizedFn((urlToGo: string) => {
      if (!url) {
        onOpenTab?.(urlToGo);
      } else {
        webviewRef.current?.injectJavaScript(
          `(function(){window.location.href = '${urlToGo
            .replace(/'/g, '%27')
            .replace(/[\r\n]/g, '')}' })()`,
        );
        setIsShowSearch(false);
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
      try {
        const viewShot = await viewShotRef.current?.capture();
        onUpdateTab?.({
          url: webviewState.url,
          viewShot,
        });
      } catch (e) {
        console.error('viewShot', e);
      }
      navigation.navigate(RootNames.StackBrowser, {
        screen: RootNames.BrowserManageScreen,
      });
    });

    return (
      <AutoLockView style={[style, styles.dappWebViewControl]}>
        <BrowserHeader
          url={webviewState.url}
          isFocused={isShowSearch}
          onFocusChange={v => {
            setIsShowSearch(v);
          }}
          onSearch={search => {
            handleGoTo(
              `https://google.com/search?q=${encodeURIComponent(search)}`,
            );
          }}
        />

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
          <ViewShot
            ref={viewShotRef}
            style={{ flex: 1, backgroundColor: colors2024['neutral-bg-1'] }}
            options={{
              format: 'jpg',
              quality: 0.2,
            }}>
            {isShowSearch || !url ? (
              <BrowserBookmarkSection
                onPress={dapp => {
                  const urlToGo = dapp.url || dapp.origin;
                  handleGoTo(urlToGo);
                }}
              />
            ) : null}
            {!url || !entryScriptWeb3Loaded ? null : (
              <>
                {isLoading ? (
                  <BrowserProgressBar
                    progress={progress}
                    style={styles.progressBar}
                  />
                ) : null}
                <WebView
                  // cacheEnabled={false}
                  cacheEnabled
                  startInLoadingState={false}
                  renderLoading={() => <View style={{ display: 'none' }} />}
                  allowsFullscreenVideo={false}
                  allowsInlineMediaPlayback={false}
                  originWhitelist={['*']}
                  {...webviewProps}
                  style={[
                    styles.dappWebView,
                    webviewProps?.style,
                    isShowSearch
                      ? {
                          display: 'none',
                        }
                      : null,
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
                  applicationNameForUserAgent={APP_UA_PARIALS.UA_FULL_NAME}
                  javaScriptEnabled
                  // androidLayerType='software'
                  injectedJavaScriptBeforeContentLoaded={fullScript}
                  injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
                  {...(IS_ANDROID && {
                    injectedJavaScript: PATCH_ANCHOR_TARGET,
                  })}
                  onNavigationStateChange={
                    webviewActions.onNavigationStateChange
                  }
                  webviewDebuggingEnabled={__DEV__}
                  onLoadStart={e => {
                    webviewProps?.onLoadStart?.(e);
                    onLoadStart(e);
                    setIsLoading(true);
                    setProgress(0);
                    const { nativeEvent } = e;
                    if (nativeEvent.loading) {
                      return;
                    }
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
                    console.log('xxx??', nativeEvent.progress);
                    setProgress(nativeEvent.progress);
                    if (nativeEvent.progress === 1) {
                      setIsLoading(false);
                    }
                  }}
                  onLoadEnd={e => {
                    setIsLoading(false);
                    webviewProps?.onLoadEnd?.(e);
                    const { nativeEvent } = e;
                    if (nativeEvent.loading) {
                      return;
                    }
                    console.log('loadend');
                    onUpdateTab?.({
                      url: nativeEvent.url,
                      name: nativeEvent.title,
                    });
                    onUpdateHistory?.({
                      name: nativeEvent.title,
                      url: nativeEvent.url,
                    });
                  }}
                  onShouldStartLoadWithRequest={nativeEvent => {
                    return checkShouldStartLoadingWithRequestForDappWebView(
                      nativeEvent,
                    );
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
          </ViewShot>
        </View>
        <View style={styles.dappWebViewNavControl}>
          <BrowserFooter
            canReload={!!url}
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
            canViewMore={!!url}
          />
        </View>
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
  }),
);
