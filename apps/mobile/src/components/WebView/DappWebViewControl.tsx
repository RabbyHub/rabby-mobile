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

import {
  BottomSheetBackdropProps,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';

import { Text } from '../Text';

import { ScreenLayouts } from '@/constant/layout';
import { useThemeStyles } from '@/hooks/theme';

import { RcIconMore } from './icons';
import { devLog } from '@/utils/logger';
import { useSheetModal } from '@/hooks/useSheetModal';
import TouchableView from '../Touchable/TouchableView';
import { WebViewActions, WebViewState, useWebViewControl } from './hooks';
import { DappNavCardBottomSheetModal } from '../customized/BottomSheet';
import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import {
  BUILTIN_SPECIAL_URLS,
  useSetupWebview,
} from '@/core/bridges/useBackgroundBridge';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { BottomNavControl, BottomNavControlCbCtx } from './Widgets';
import { formatDappOriginToShow } from '@/utils/url';
import { APP_UA_PARIALS } from '@/constant';
import { createGetStyles } from '@/utils/styles';
import AutoLockView from '../AutoLockView';
import { RefreshAutoLockBottomSheetBackdrop } from '../patches/refreshAutoLockUI';
import { PATCH_ANCHOR_TARGET } from '@/core/bridges/builtInScripts/patchAnchor';
import { IS_ANDROID } from '@/core/native/utils';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { checkShouldStartLoadingWithRequestForDappWebView } from './utils';

function errorLog(...info: any) {
  // devLog('[DappWebViewControl::error]', ...info);
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

function BottomSheetMoreLayout({ children }: React.PropsWithChildren) {
  // if (Platform.OS !== 'ios') {
  //   return (
  //     <View
  //       className={clsx('absolute left-[0] h-[100%] w-[100%]')}
  //       style={{
  //         // BottomSheetModalProvider is provided isolated from the main app below, the start point on vertical axis is
  //         // the parent of this component
  //         top: -ScreenLayouts.headerAreaHeight,
  //       }}>
  //       {children}
  //     </View>
  //   )
  // }

  return <>{children}</>;
}

const renderBackdrop = (props: BottomSheetBackdropProps) => {
  return (
    <RefreshAutoLockBottomSheetBackdrop
      {...props}
      // leave here for debug
      style={[
        props.style,
        {
          borderWidth: 1,
          borderColor: 'red',
        },
      ]}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
    />
  );
};

type DappWebViewControlProps = {
  dappOrigin: string;
  dappTabId?: string;
  /**
   * @description if embedHtml provided, dappOrigin would be ignored
   */
  embedHtml?: string;
  initialUrl?: string;
  onPressMore?: (ctx: { defaultAction: () => void }) => void;

  bottomNavH?: number;
  headerLeft?: React.ReactNode | (() => React.ReactNode);
  headerNode?:
    | React.ReactNode
    | ((ctx: { header: React.ReactNode | null }) => React.ReactNode);
  bottomSheetContent?:
    | React.ReactNode
    | ((
        ctx: BottomNavControlCbCtx & { bottomNavBar: React.ReactNode },
      ) => React.ReactNode);
  webviewProps?: React.ComponentProps<typeof WebView>;
  webviewNode?:
    | React.ReactNode
    | ((ctx: { webview: React.ReactNode | null }) => React.ReactNode);
  style?: StyleProp<ViewStyle>;

  onSelfClose?: (reason: 'phishing') => void;
};

function useDefaultNodes({
  headerLeft,
  bottomSheetContent,
  webviewState,
  webviewActions,
}: {
  headerLeft?: DappWebViewControlProps['headerLeft'];
  bottomSheetContent?: DappWebViewControlProps['bottomSheetContent'];
  webviewState: WebViewState;
  webviewActions: ReturnType<typeof useWebViewControl>['webviewActions'];
}) {
  const { styles } = useThemeStyles(getStyles);
  const defaultHeaderLeft = useMemo(() => {
    return (
      <View style={[styles.touchableHeadWrapper]}>
        <Text> </Text>
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerLeftNode = useMemo(() => {
    if (typeof headerLeft === 'function') {
      return headerLeft() || defaultHeaderLeft;
    }

    return headerLeft || defaultHeaderLeft;
  }, [headerLeft, defaultHeaderLeft]);

  const bottomSheetContentNode = useMemo(() => {
    const bottomNavBar = (
      <BottomNavControl
        webviewState={webviewState}
        webviewActions={webviewActions}
      />
    );

    if (typeof bottomSheetContent === 'function') {
      return (
        bottomSheetContent({ bottomNavBar, webviewState, webviewActions }) ||
        bottomNavBar
      );
    }

    return bottomSheetContent || bottomNavBar;
  }, [bottomSheetContent, webviewState, webviewActions]);

  return {
    headerLeftNode,
    bottomSheetContentNode,
  };
}

export type DappWebViewControlType = {
  closeWebViewNavModal: () => void;
  getWebViewId: () => string;
  getWebViewState: () => WebViewState;
  getWebViewActions: () => WebViewActions;
};
const DappWebViewControl = React.forwardRef<
  DappWebViewControlType,
  DappWebViewControlProps
>(
  (
    {
      dappOrigin,
      dappTabId,
      embedHtml,
      initialUrl: _initialUrl,
      onPressMore,

      bottomNavH = ScreenLayouts.defaultWebViewNavBottomSheetHeight,
      headerLeft,
      headerNode,
      bottomSheetContent,
      webviewProps,
      webviewNode,
      style,
      onSelfClose,
    },
    ref,
  ) => {
    const { styles, colors } = useThemeStyles(getStyles);

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

    const { formattedCurrentUrl } = useMemo(() => {
      return {
        formattedCurrentUrl: latestUrl || convertToWebviewUrl(dappOrigin),
      };
    }, [dappOrigin, latestUrl]);

    const { sheetModalRef: webviewNavRef, toggleShowSheetModal } =
      useSheetModal();

    React.useImperativeHandle(
      ref,
      () => ({
        closeWebViewNavModal: () => {
          webviewNavRef?.current?.close();
        },
        getWebViewId: () => webviewIdRef.current || '',
        getWebViewState: () => webviewState,
        getWebViewActions: () => webviewActions,
      }),
      [webviewNavRef, webviewIdRef, webviewState, webviewActions],
    );

    const handlePressMoreDefault = useCallback(() => {
      toggleShowSheetModal(true);
    }, [toggleShowSheetModal]);

    const handlePressMore = useCallback(() => {
      if (typeof onPressMore === 'function') {
        return onPressMore({
          defaultAction: handlePressMoreDefault,
        });
      }

      return handlePressMoreDefault();
    }, [handlePressMoreDefault, onPressMore]);

    const { headerLeftNode, bottomSheetContentNode } = useDefaultNodes({
      headerLeft,
      bottomSheetContent,
      webviewState,
      webviewActions,
    });

    const renderedHeaderNode = useMemo(() => {
      const node = (
        <View style={[styles.dappWebViewHeadContainer]}>
          <View style={[styles.touchableHeadWrapper, styles.flexShrink0]}>
            {headerLeftNode}
          </View>
          <View style={styles.DappWebViewHeadTitleWrapper}>
            <Text
              style={{
                ...styles.HeadTitleOrigin,
                color: colors['neutral-title-1'],
              }}
              numberOfLines={1}
              ellipsizeMode="tail">
              {formatDappOriginToShow(dappOrigin)}
            </Text>

            <Text
              style={{
                ...styles.HeadTitleMainDomain,
                color: colors['neutral-foot'],
              }}
              numberOfLines={1}
              ellipsizeMode="tail">
              {formattedCurrentUrl}
            </Text>
          </View>
          <View style={[styles.touchableHeadWrapper, styles.flexShrink0]}>
            <TouchableView
              onPress={handlePressMore}
              style={[styles.touchableHeadWrapper]}>
              <RcIconMore width={24} height={24} />
            </TouchableView>
          </View>
        </View>
      );
      if (typeof headerNode === 'function') {
        return headerNode({ header: node });
      }

      return headerNode || node;
    }, [
      headerLeftNode,
      headerNode,
      colors,
      dappOrigin,
      handlePressMore,
      formattedCurrentUrl,
      styles,
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

    const { cutOffSizes } = useSafeAndroidBottomSizes({
      webviewNodeContainerMaxH:
        Dimensions.get('window').height -
        ScreenLayouts.dappWebViewControlHeaderHeight,
    });

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
            {
              maxHeight: cutOffSizes.webviewNodeContainerMaxH,
            },
          ]}>
          {renderedWebviewNode}
        </View>

        <BottomSheetMoreLayout>
          <BottomSheetModalProvider>
            <DappNavCardBottomSheetModal
              bottomNavH={bottomNavH}
              ref={webviewNavRef}>
              {bottomSheetContentNode}
            </DappNavCardBottomSheetModal>
          </BottomSheetModalProvider>
        </BottomSheetMoreLayout>
      </AutoLockView>
    );
  },
);

const getStyles = createGetStyles(colors =>
  StyleSheet.create({
    dappWebViewControl: {
      position: 'relative',
      // don't put backgroundColor here to avoid cover the background on BottomSheetModal
      backgroundColor: 'transparent',
      width: '100%',
      height: '100%',
      paddingVertical: 10,
    },
    dappWebViewHeadContainer: {
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
      maxWidth: Dimensions.get('window').width,
      minHeight: ScreenLayouts.dappWebViewControlHeaderHeight,
      paddingHorizontal: 20,
      paddingVertical: 0,
      backgroundColor: colors['neutral-bg-1'],
    },
    flexShrink0: {
      flexShrink: 0,
    },
    touchableHeadWrapper: {
      height: ScreenLayouts.dappWebViewControlHeaderHeight,
      justifyContent: 'center',
      flexShrink: 0,
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
      fontSize: 16,
      fontWeight: '500',
      textAlign: 'center',
    },
    HeadTitleMainDomain: {
      fontSize: 11,
      fontWeight: '400',
      textAlign: 'center',
      maxWidth: '90%',
    },

    dappWebViewContainer: {
      flexShrink: 1,
      flex: 1,
      height: '100%',
    },
    dappWebView: {
      flex: 1,
      height: '100%',
      width: '100%',
      opacity: 0.99,
      overflow: 'hidden',
    },
  }),
);

export default DappWebViewControl;
