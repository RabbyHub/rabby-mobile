import { useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import WebView from 'react-native-webview';
import clsx from 'clsx';

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

import {
  RcIconMore,
  RcIconNavBack,
  RcIconNavForward,
  RcIconNavHome,
  RcIconNavReload,
  RcIconNavFavorite,
} from './icons';
import { devLog } from '@/utils/logger';
import { useSheetModals } from '@/hooks/useSheetModal';
import TouchableView from '../Touchable/TouchableView';
import { WebViewState, useWebViewControl } from './hooks';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import { useSetupWebview } from '@/core/bridges/useBackgroundBridge';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';

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

const PRESS_OPACITY = 0.3;

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

function useBottomSheetMoreLayout(bottomNavH: number) {
  const { safeTop, safeOffHeader } = useSafeSizes();

  return {
    // topSnapPoint: Platform.OS === 'ios' ? bottomNavH + safeOffHeader : bottomNavH + safeTop
    topSnapPoint: bottomNavH + safeOffHeader,
  };
}

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);
const bottomNavStyles = StyleSheet.create({
  navControls: {
    width: '100%',
    height: 52,
    paddingHorizontal: 26,
    // gap: 28,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navControlItem: {
    height: '100%',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disabledStyle: {
    opacity: 0.3,
  },
});
function BottomNavControl({
  webviewState,
  webviewActions,
}: {
  webviewState: WebViewState;
  webviewActions: ReturnType<typeof useWebViewControl>['webviewActions'];
}) {
  return (
    <View style={[bottomNavStyles.navControls]}>
      <TouchableView
        pressOpacity={PRESS_OPACITY}
        style={[
          bottomNavStyles.navControlItem,
          !webviewState?.canGoBack && bottomNavStyles.disabledStyle,
        ]}
        onPress={webviewActions.handleGoBack}>
        <RcIconNavBack width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={PRESS_OPACITY}
        style={[
          bottomNavStyles.navControlItem,
          !webviewState?.canGoForward && bottomNavStyles.disabledStyle,
        ]}
        onPress={webviewActions.handleGoForward}>
        <RcIconNavForward width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={webviewActions.handleReload}>
        <RcIconNavReload width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={() => {}}>
        <RcIconNavHome width={26} height={26} />
      </TouchableView>
      <TouchableView
        pressOpacity={PRESS_OPACITY}
        style={[bottomNavStyles.navControlItem]}
        onPress={() => {}}>
        <RcIconNavFavorite width={26} height={26} />
      </TouchableView>
    </View>
  );
}

type DappWebViewControlProps = {
  dappOrigin: string;
  initialUrl?: string;
  onPressMore?: (ctx: { defaultAction: () => void }) => void;

  bottomNavH?: number;
  headerLeft?: React.ReactNode | (() => React.ReactNode);
  bottomSheetContent?:
    | React.ReactNode
    | ((ctx: { bottomNavBar: React.ReactNode }) => React.ReactNode);
  webviewProps?: React.ComponentProps<typeof WebView>;
  style?: StyleProp<ViewStyle>;
};

function useDefaultNodes({
  headerLeft,
  bottomSheetContent,
  webviewRef,
  webviewState,
  webviewActions,
}: {
  headerLeft?: DappWebViewControlProps['headerLeft'];
  bottomSheetContent?: DappWebViewControlProps['bottomSheetContent'];
  webviewRef: React.RefObject<WebView>;
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

  const bottomNavBar = useMemo(() => {
    return (
      <BottomNavControl
        webviewState={webviewState}
        webviewActions={webviewActions}
      />
    );
  }, [webviewState, webviewActions]);

  const bottomSheetContentNode = useMemo(() => {
    if (typeof bottomSheetContent === 'function') {
      return bottomSheetContent({ bottomNavBar }) || bottomNavBar;
    }

    return bottomSheetContent || bottomNavBar;
  }, [bottomSheetContent, bottomNavBar]);

  return {
    headerLeftNode,
    bottomSheetContentNode,
  };
}

export default function DappWebViewControl({
  dappOrigin,
  initialUrl: _initialUrl,
  onPressMore,

  bottomNavH = ScreenLayouts.defaultWebViewNavBottomSheetHeight,
  headerLeft,
  bottomSheetContent,
  webviewProps,
  style,
}: DappWebViewControlProps) {
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
    webviewRef,
    webviewState,
    webviewActions,
  });
  const { topSnapPoint } = useBottomSheetMoreLayout(bottomNavH);

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

  return (
    <View
      style={[
        style,
        styles.dappWebViewControl,
        {
          position: 'relative',
          backgroundColor: colors['neutral-bg-1'],
        },
      ]}>
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

      {/* webvbiew */}
      <View style={[styles.dappWebViewContainer]}>
        {entryScriptWeb3Loaded && (
          <WebView
            // cacheEnabled={false}
            cacheEnabled
            startInLoadingState
            {...webviewProps}
            style={[styles.dappWebView, webviewProps?.style]}
            ref={webviewRef}
            source={{
              uri: initialUrl,
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
        )}
      </View>

      <BottomSheetMoreLayout>
        <BottomSheetModalProvider>
          <AppBottomSheetModal
            index={0}
            backdropComponent={renderBackdrop}
            enableContentPanningGesture={false}
            name="webviewNavRef"
            handleHeight={28}
            ref={webviewNavRef}
            snapPoints={[topSnapPoint]}>
            <BottomSheetView className="px-[20] items-center justify-center">
              {bottomSheetContentNode}
            </BottomSheetView>
          </AppBottomSheetModal>
        </BottomSheetModalProvider>
      </BottomSheetMoreLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  dappWebViewControl: {
    width: '100%',
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
