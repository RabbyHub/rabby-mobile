import React, { useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import WebView from 'react-native-webview';

import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';

import { Text } from '../Text';

import { ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';

import { RcIconMore } from './icons';
import { devLog } from '@/utils/logger';
import { useSheetModals } from '@/hooks/useSheetModal';
import TouchableView from '../Touchable/TouchableView';
import { WebViewActions, WebViewState, useWebViewControl } from './hooks';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  AppBottomSheetModal,
  DappNavCardBottomSheetModal,
} from '../customized/BottomSheet';
import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import { useSetupWebview } from '@/core/bridges/useBackgroundBridge';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { BottomNavControl, BottomNavControlCbCtx } from './Widgets';

function errorLog(...info: any) {
  devLog('[DappWebViewControl::error]', ...info);
}

function convertToWebviewUrl(dappOrigin: string) {
  if (__DEV__) {
    if (dappOrigin.startsWith('http://')) {
      return dappOrigin;
    }
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
    <BottomSheetBackdrop
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
  const defaultHeaderLeft = useMemo(() => {
    return (
      <View style={[styles.touchableHeadWrapper]}>
        <Text> </Text>
      </View>
    );
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
  getWebViewActions: () => WebViewActions;
};
const DappWebViewControl = React.forwardRef<
  DappWebViewControlType,
  DappWebViewControlProps
>(
  (
    {
      dappOrigin,
      initialUrl: _initialUrl,
      onPressMore,

      bottomNavH = ScreenLayouts.defaultWebViewNavBottomSheetHeight,
      headerLeft,
      headerNode,
      bottomSheetContent,
      webviewProps,
      webviewNode,
      style,
    },
    ref,
  ) => {
    const colors = useThemeColors();

    const {
      webviewRef,
      urlRef,
      titleRef,
      iconRef,

      webviewState,

      latestUrl,
      webviewActions,
    } = useWebViewControl();

    React.useImperativeHandle(
      ref,
      () => ({
        closeWebViewNavModal: () => {
          webviewNavRef?.current?.close();
        },
        getWebViewActions: () => webviewActions,
      }),
      [webviewActions],
    );

    const { entryScriptWeb3Loaded, fullScript } =
      useJavaScriptBeforeContentLoaded({ isTop: false });

    const { subTitle } = useMemo(() => {
      return {
        subTitle: latestUrl
          ? urlUtils.canoicalizeDappUrl(latestUrl).httpOrigin
          : convertToWebviewUrl(dappOrigin),
      };
    }, [dappOrigin, latestUrl]);

    const {
      sheetModalRefs: { webviewNavRef },
      toggleShowSheetModal,
    } = useSheetModals({
      webviewNavRef: useRef<AppBottomSheetModal>(null),
    });

    const handlePressMoreDefault = useCallback(() => {
      toggleShowSheetModal('webviewNavRef', true);
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
          <View style={[styles.touchableHeadWrapper]}>{headerLeftNode}</View>
          <View style={styles.DappWebViewHeadTitleWrapper}>
            <Text
              style={{
                ...styles.HeadTitleOrigin,
                color: colors['neutral-title-1'],
              }}>
              {dappOrigin}
            </Text>

            <Text
              style={{
                ...styles.HeadTitleMainDomain,
                color: colors['neutral-foot'],
              }}>
              {subTitle}
            </Text>
          </View>
          <View style={[styles.touchableHeadWrapper]}>
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
      subTitle,
    ]);

    const { onLoadStart, onMessage: onBridgeMessage } = useSetupWebview({
      dappOrigin,
      webviewRef,
      siteInfoRefs: {
        urlRef,
        titleRef,
        iconRef,
      },
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
          {...webviewProps}
          style={[styles.dappWebView, webviewProps?.style]}
          ref={webviewRef}
          source={{
            uri: initialUrl,
            // TODO: cusotmize userAgent here
            // 'User-Agent': ''
          }}
          injectedJavaScriptBeforeContentLoaded={fullScript}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
          onNavigationStateChange={webviewActions.onNavigationStateChange}
          onError={errorLog}
          webviewDebuggingEnabled={__DEV__}
          onLoadStart={nativeEvent => {
            webviewProps?.onLoadStart?.(nativeEvent);
            onLoadStart(nativeEvent);
          }}
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
      webviewProps,
      entryScriptWeb3Loaded,
      fullScript,
      initialUrl,
      onBridgeMessage,
      onLoadStart,
      webviewActions.onNavigationStateChange,
      webviewNode,
      webviewRef,
    ]);

    return (
      <View style={[style, styles.dappWebViewControl]}>
        {renderedHeaderNode}

        {/* webvbiew */}
        <View
          style={[
            styles.dappWebViewContainer,
            {
              maxHeight:
                Dimensions.get('window').height -
                ScreenLayouts.dappWebViewControlHeaderHeight,
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
      </View>
    );
  },
);

const styles = StyleSheet.create({
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
  },
  touchableHeadWrapper: {
    height: ScreenLayouts.dappWebViewControlHeaderHeight,
    justifyContent: 'center',
    flexShrink: 0,
  },
  DappWebViewHeadTitleWrapper: {
    flexDirection: 'column',
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
  },

  dappWebViewContainer: {
    flexShrink: 1,
    height: '100%',
  },
  dappWebView: {
    height: '100%',
    width: '100%',
    opacity: 1,
    overflow: 'hidden',
  },
});

export default DappWebViewControl;
