import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { AppBottomSheetModal } from '../customized/BottomSheet';

function errorLog(...info: any) {
  devLog('[DappWebViewControl::error]', ...info);
}

const PRESS_OPACITY = 0.3;

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

export default function DappWebViewControl({
  dappId,
  onPressMore,

  bottomNavH = ScreenLayouts.defaultWebViewNavBottomSheetHeight,
  headerLeft,
  bottomSheetContent,
}: {
  dappId: string;
  onPressMore?: (ctx: { defaultAction: () => void }) => void;

  bottomNavH?: number;
  headerLeft?: React.ReactNode | (() => React.ReactNode);
  bottomSheetContent?:
    | React.ReactNode
    | ((ctx: { bottomNavBar: React.ReactNode }) => React.ReactNode);
}) {
  const colors = useThemeColors();

  const {
    webviewRef,
    webviewState,

    latestUrl,
    webviewActions,
  } = useWebViewControl();

  const { subTitle } = useMemo(() => {
    return {
      subTitle: latestUrl
        ? urlUtils.canoicalizeDappUrl(latestUrl).httpOrigin
        : stringUtils.ensurePrefix(dappId, 'https://'),
    };
  }, [dappId, latestUrl]);

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
  }, [handlePressMoreDefault]);

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
  }, [headerLeft]);

  const bottomNavBar = useMemo(() => {
    return (
      <BottomNavControl
        webviewState={webviewState}
        webviewActions={webviewActions}
      />
    );
  }, [webviewRef, webviewState, webviewActions]);

  const bottomSheetContentNode = useMemo(() => {
    if (typeof bottomSheetContent === 'function') {
      return bottomSheetContent({ bottomNavBar }) || bottomNavBar;
    }

    return bottomSheetContent || bottomNavBar;
  }, [bottomSheetContent, bottomNavBar]);

  const { safeTop } = useSafeSizes();

  return (
    <View
      style={[
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
            {dappId}
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
          <TouchableView onPress={handlePressMore}>
            <RcIconMore width={24} height={24} />
          </TouchableView>
        </View>
      </View>

      {/* webvbiew */}
      <View style={[styles.dappWebViewContainer]}>
        <WebView
          style={[styles.dappWebView]}
          ref={webviewRef}
          source={{
            uri: stringUtils.ensurePrefix(dappId, 'https://'),
          }}
          onNavigationStateChange={webviewActions.onNavigationStateChange}
          onError={errorLog}
        />
      </View>

      <View
        className={clsx('absolute left-[0] h-[100%] w-[100%]')}
        style={{
          // BottomSheetModalProvider is provided isolated from the main app below, the start point on vertical axis is
          // the parent of this component
          top: -ScreenLayouts.headerAreaHeight,
        }}>
        <BottomSheetModalProvider>
          <AppBottomSheetModal
            index={0}
            backdropComponent={renderBackdrop}
            enableContentPanningGesture={false}
            name="webviewNavRef"
            handleHeight={28}
            ref={webviewNavRef}
            snapPoints={[bottomNavH + safeTop]}>
            <BottomSheetView className="px-[20] items-center justify-center">
              {bottomSheetContentNode}
            </BottomSheetView>
          </AppBottomSheetModal>
        </BottomSheetModalProvider>
      </View>
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
