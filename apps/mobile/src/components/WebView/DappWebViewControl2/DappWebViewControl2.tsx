import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import WebView from 'react-native-webview';

import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';

import { Text } from '../../Text';

import { ScreenLayouts2 } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import { RcIconCloseDapp } from './icons';
import TouchableView from '@/components/Touchable/TouchableView';
import { WebViewActions, WebViewState, useWebViewControl } from '../hooks';
import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import {
  BUILTIN_SPECIAL_URLS,
  useSetupWebview,
} from '@/core/bridges/useBackgroundBridge';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { BottomNavControl2, BottomNavControlCbCtx } from './Widgets';
import { APP_UA_PARIALS } from '@/constant';
import { createGetStyles2024 } from '@/utils/styles';
import AutoLockView from '@/components/AutoLockView';
import { PATCH_ANCHOR_TARGET } from '@/core/bridges/builtInScripts/patchAnchor';
import { IS_ANDROID } from '@/core/native/utils';
import { checkShouldStartLoadingWithRequestForDappWebView } from '../utils';
import { FontNames } from '@/core/utils/fonts';
import { DappWebViewHideContext } from '@/screens/Dapps/hooks/useDappView';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useMemoizedFn } from 'ahooks';
import Clipboard from '@react-native-clipboard/clipboard';
import { toast } from '@/components2024/Toast';

function errorLog(...info: any) {
  // devLog('[DappWebViewControl2::error]', ...info);
}

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

type DappWebViewControlProps = {
  dappOrigin: string;
  dappTabId?: string;
  /**
   * @description if embedHtml provided, dappOrigin would be ignored
   */
  embedHtml?: string;
  initialUrl?: string;
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
};

function useDefaultNodes({
  headerRight,
  navControlContent,
  webviewState,
  webviewActions,
}: {
  headerRight?: DappWebViewControlProps['headerRight'];
  navControlContent?: DappWebViewControlProps['navControlContent'];
  webviewState: WebViewState;
  webviewActions: ReturnType<typeof useWebViewControl>['webviewActions'];
}) {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const defaultHeaderRight = useMemo(() => {
    return (
      <View style={[styles.touchableHeadWrapper]}>
        <Text> </Text>
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerRightNode = useMemo(() => {
    if (typeof headerRight === 'function') {
      return headerRight() || defaultHeaderRight;
    }

    return headerRight || defaultHeaderRight;
  }, [headerRight, defaultHeaderRight]);

  const finalNavControlNode = useMemo(() => {
    const bottomNavBar = (
      <BottomNavControl2
        webviewState={webviewState}
        webviewActions={webviewActions}
      />
    );

    if (typeof navControlContent === 'function') {
      return (
        navControlContent({ bottomNavBar, webviewState, webviewActions }) ||
        bottomNavBar
      );
    }

    return navControlContent || bottomNavBar;
  }, [navControlContent, webviewState, webviewActions]);

  return {
    headerRightNode,
    finalNavControlNode,
  };
}

export type DappWebViewControl2Type = {
  getWebViewDappOrigin: () => string;
  getWebViewId: () => string;
  getWebViewState: () => WebViewState;
  getWebViewActions: () => WebViewActions;
};
const DappWebViewControl2 = React.forwardRef<
  DappWebViewControl2Type,
  DappWebViewControlProps
>(
  (
    {
      dappOrigin,
      dappTabId,
      embedHtml,
      initialUrl: _initialUrl,
      onPressHeaderLeftClose,

      headerRight,
      headerNode,
      navControlContent,
      webviewProps,
      webviewContainerMaxHeight = Dimensions.get('screen').height,
      webviewNode,
      style,
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

      latestUrl,
      webviewActions,
    } = useWebViewControl({ initialTabId: dappTabId });

    const { entryScriptWeb3Loaded, fullScript } =
      useJavaScriptBeforeContentLoaded();

    const { formattedCurrentUrl, stillInDappOrigin, urlString } =
      useMemo(() => {
        const urlString = latestUrl || convertToWebviewUrl(dappOrigin);
        const urlInfo = canoicalizeDappUrl(urlString);

        const hasSameOrigin =
          canoicalizeDappUrl(urlString).httpOrigin === dappOrigin;

        return {
          stillInDappOrigin: hasSameOrigin,
          formattedCurrentUrl: hasSameOrigin ? urlInfo.hostname : urlString,
          urlString,
        };
      }, [dappOrigin, latestUrl]);

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

    const handlePressCloseDefault = useCallback(() => {
      console.debug('handlePressCloseDefault: implement close dapp');
    }, []);

    const handlePressHeaderLeftClose = useCallback(() => {
      if (typeof onPressHeaderLeftClose === 'function') {
        return onPressHeaderLeftClose({
          defaultAction: handlePressCloseDefault,
          dappOrigin: dappOrigin,
          latestUrl: latestUrl,
          webviewId: webviewIdRef.current,
        });
      }

      return handlePressCloseDefault();
    }, [
      handlePressCloseDefault,
      onPressHeaderLeftClose,
      dappOrigin,
      latestUrl,
      webviewIdRef,
    ]);

    const { headerRightNode, finalNavControlNode } = useDefaultNodes({
      headerRight,
      navControlContent,
      webviewState,
      webviewActions,
    });

    const handleCopyUrl = useMemoizedFn(() => {
      Clipboard.setString(urlString);
      toast.success('Copied!');
    });

    const renderedHeaderNode = useMemo(() => {
      const node = (
        <View style={[styles.dappWebViewHeadContainer]}>
          <View style={[styles.touchableHeadWrapper, styles.flexShrink0]}>
            <TouchableView
              onPress={handlePressHeaderLeftClose}
              style={[styles.touchableHeadWrapper]}>
              <RcIconCloseDapp
                color={styles.closeDappIcon.color}
                width={24}
                height={24}
              />
            </TouchableView>
          </View>
          <View style={styles.DappWebViewHeadTitleWrapper}>
            <TouchableOpacity onPress={handleCopyUrl}>
              {stillInDappOrigin ? (
                <Text
                  style={styles.HeadTitleOrigin}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {formattedCurrentUrl}
                </Text>
              ) : (
                <Text
                  style={styles.HeadTitleFull}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {formattedCurrentUrl}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={[styles.touchableHeadWrapper, styles.flexShrink0]}>
            {headerRightNode}
          </View>
        </View>
      );
      if (typeof headerNode === 'function') {
        return headerNode({ header: node });
      }

      return headerNode || node;
    }, [
      stillInDappOrigin,
      headerRightNode,
      headerNode,
      handlePressHeaderLeftClose,
      formattedCurrentUrl,
      styles,
      handleCopyUrl,
    ]);

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

    const initialUrl = useMemo(() => {
      if (!_initialUrl) return convertToWebviewUrl(dappOrigin);

      if (
        canoicalizeDappUrl(_initialUrl).origin !==
        canoicalizeDappUrl(dappOrigin).origin
      )
        return convertToWebviewUrl(dappOrigin);

      return convertToWebviewUrl(_initialUrl);
    }, [dappOrigin, _initialUrl]);

    const renderedWebviewNode = useMemo(() => {
      if (!entryScriptWeb3Loaded) return null;

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
                  uri: initialUrl,
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
          onLoadStart={nativeEvent => {
            webviewProps?.onLoadStart?.(nativeEvent);
            onLoadStart(nativeEvent);
          }}
          onShouldStartLoadWithRequest={nativeEvent => {
            return checkShouldStartLoadingWithRequestForDappWebView(
              nativeEvent,
            );
          }}
          onError={errorLog}
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
      embedHtml,
      webviewProps,
      entryScriptWeb3Loaded,
      fullScript,
      initialUrl,
      onBridgeMessage,
      onLoadStart,
      webviewActions.onNavigationStateChange,
      webviewNode,
      webviewRef,
      styles,
    ]);

    return (
      <AutoLockView style={[style, styles.dappWebViewControl]}>
        {renderedHeaderNode}

        {/* webvbiew */}
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
          {renderedWebviewNode}
        </View>

        <View style={styles.dappWebViewNavControl}>{finalNavControlNode}</View>
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

export default DappWebViewControl2;
