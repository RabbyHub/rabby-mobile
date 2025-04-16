import React, { useMemo, useRef } from 'react';
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
import { DappWebViewHideContext } from '@/screens/Dapps/hooks/useDappView';
import { createGetStyles2024 } from '@/utils/styles';
import { CommonActions, TabActions } from '@react-navigation/native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { BrowserFooter } from './BrowserFooter';
import { BrowserHeader } from './BrowserHeader';
import { BottomNavControlCbCtx } from './Widgets';
import { naviPush } from '@/utils/navigation';

type DappWebViewControlProps = {
  dappOrigin: string;
  dappTabId?: string;
  /**
   * @description if embedHtml provided, dappOrigin would be ignored
   */
  embedHtml?: string;
  url?: string;
  onPressHeaderLeftClose?: (
    ctx: { defaultAction: () => void } & DappWebViewHideContext,
  ) => void;

  headerRight?: React.ReactNode | (() => React.ReactNode);
  headerNode?:
    | React.ReactNode
    | ((ctx: { header: React.ReactNode | null }) => React.ReactNode);
  navControlContent?:
    | React.ReactNode
    | ((
        ctx: BottomNavControlCbCtx & { bottomNavBar: React.ReactNode },
      ) => React.ReactNode);
  webviewProps?: React.ComponentProps<typeof WebView>;
  webviewContainerMaxHeight?: number;
  webviewNode?:
    | React.ReactNode
    | ((ctx: { webview: React.ReactNode | null }) => React.ReactNode);
  style?: StyleProp<ViewStyle>;

  onSelfClose?: (reason: 'phishing') => void;
  tabsCount?: number;
  onUpdateTab?: (params: {
    url: string;
    viewShot?: string;
    name?: string;
  }) => void;
  onUpdateHistory?: (params: { url: string; name?: string }) => void;
};

export type DappWebViewControl2Type = {
  getWebViewDappOrigin: () => string;
  getWebViewId: () => string;
  getWebViewState: () => WebViewState;
  getWebViewActions: () => WebViewActions;
};
export const BrowserTab = React.forwardRef<
  DappWebViewControl2Type,
  DappWebViewControlProps
>(
  (
    {
      dappOrigin,
      dappTabId,
      embedHtml,
      url,
      webviewProps,
      webviewContainerMaxHeight = Dimensions.get('screen').height,
      webviewNode,
      style,
      tabsCount,
      onUpdateTab,
      onUpdateHistory,
    },
    ref,
  ) => {
    const { styles, colors, colors2024 } = useTheme2024({
      getStyle: getStyles,
    });

    const {
      webviewRef,
      webviewIdRef,
      urlRef,
      titleRef,
      iconRef,

      webviewState,

      webviewActions,
    } = useWebViewControl({ initialTabId: dappTabId });

    const navigation = useRabbyAppNavigation();

    const viewShotRef = useRef<any>(null);

    const { entryScriptWeb3Loaded, fullScript } =
      useJavaScriptBeforeContentLoaded({ isTop: false });

    React.useImperativeHandle(
      ref,
      () => ({
        getWebViewDappOrigin: () => dappOrigin,
        getWebViewId: () => webviewIdRef.current || '',
        getWebViewState: () => webviewState,
        getWebViewActions: () => webviewActions,
      }),
      [dappOrigin, webviewIdRef, webviewState, webviewActions],
    );

    const { onLoadStart, onMessage: onBridgeMessage } = useSetupWebview({
      dappOrigin,
      webviewRef,
      webviewIdRef,
      siteInfoRefs: {
        urlRef,
        titleRef,
        iconRef,
      },
      // onSelfClose,
    });

    const renderedWebviewNode = useMemo(() => {
      if (!entryScriptWeb3Loaded) {
        return null;
      }

      const node = (
        <WebView
          // cacheEnabled={false}
          cacheEnabled
          startInLoadingState
          allowsFullscreenVideo={false}
          allowsInlineMediaPlayback={false}
          originWhitelist={['*']}
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
          applicationNameForUserAgent={APP_UA_PARIALS.UA_FULL_NAME}
          javaScriptEnabled
          // androidLayerType='software'
          injectedJavaScriptBeforeContentLoaded={fullScript}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
          {...(IS_ANDROID && {
            injectedJavaScript: PATCH_ANCHOR_TARGET,
          })}
          onNavigationStateChange={webviewActions.onNavigationStateChange}
          webviewDebuggingEnabled={__DEV__}
          onLoadStart={e => {
            webviewProps?.onLoadStart?.(e);
            onLoadStart(e);
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
          onLoadEnd={e => {
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
      );

      if (typeof webviewNode === 'function') {
        return webviewNode({ webview: node });
      }

      return webviewNode || node;
    }, [
      entryScriptWeb3Loaded,
      webviewProps,
      styles.dappWebView,
      webviewRef,
      embedHtml,
      url,
      fullScript,
      webviewActions.onNavigationStateChange,
      webviewNode,
      onLoadStart,
      urlRef,
      onUpdateTab,
      onUpdateHistory,
      onBridgeMessage,
    ]);

    return (
      <AutoLockView style={[style, styles.dappWebViewControl]}>
        <BrowserHeader url={webviewState.url} />
        {/* webview */}
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
            style={{ flex: 1 }}
            options={{
              format: 'jpg',
              quality: 0.2,
            }}>
            {renderedWebviewNode}
          </ViewShot>
        </View>
        <View style={styles.dappWebViewNavControl}>
          <BrowserFooter
            webviewState={webviewState}
            canGoBack={webviewState.canGoBack}
            canGoForward={webviewState.canGoForward}
            tabsCount={tabsCount}
            webviewActions={webviewActions}
            onPressViewTabs={async () => {
              try {
                const viewShot = await viewShotRef.current?.capture();
                // const viewShot = await captureRef(viewShotRef, {
                //   format: 'jpg',
                //   quality: 0.2,
                // });
                console.log('viewShot', viewShot);
                onUpdateTab?.({
                  url: webviewState.url,
                  viewShot,
                });
              } catch (e) {
                console.error('viewShot', e);
              }
              navigation.dispatch(TabActions.jumpTo(RootNames.BrowserManage));
              const state = navigation.getState();
              console.log(JSON.stringify(state));
              // navigation.navigate(RootNames.BrowserManage as any);
              // navigation.dispatch(
              //   CommonActions.reset({
              //     ...state,
              //     routes: [
              //       ...state.routes,
              //       {
              //         name: RootNames.BrowserManage,
              //       },
              //     ],
              //   }),
              // );

              // navigation.dispatch(TabActions.jumpTo(RootNames.BrowserManage));
              // naviPush(RootNames.BrowserManage)
              // naviPush(RootNames.BrowserManage as any);
            }}
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
  }),
);
