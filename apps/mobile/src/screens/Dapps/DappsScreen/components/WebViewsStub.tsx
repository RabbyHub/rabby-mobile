import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, Platform, Text, View } from 'react-native';
import {
  useOpenUrlView,
  useOpenDappView,
  useActiveViewSheetModalRefs,
  OPEN_DAPP_VIEW_INDEXES,
} from '../../hooks/useDappView';
import { devLog } from '@/utils/logger';
import {
  BottomSheetBackdropProps,
  BottomSheetModalProps,
  useBottomSheet,
  useBottomSheetGestureHandlers,
} from '@gorhom/bottom-sheet';

import DappWebViewControl2, {
  DappWebViewControl2Type,
} from '@/components/WebView/DappWebViewControl2/DappWebViewControl2';
import { useDapps } from '@/hooks/useDapps';
import TouchableView from '@/components/Touchable/TouchableView';
import { RootNames, ScreenLayouts2 } from '@/constant/layout';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';
import { useCurrentAccount, useWalletBrandLogo } from '@/hooks/account';
import { navigate } from '@/utils/navigation';
import {
  AppBottomSheetHandle,
  BottomSheetHandlableView,
} from '@/components/customized/BottomSheetHandle';
import {
  OpenedDappBottomSheetModal,
  useAutoLockBottomSheetModalOnChange,
} from '@/components';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect } from '@react-navigation/native';
import {
  createGetStyles,
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { useTheme2024, useThemeStyles } from '@/hooks/theme';
import { useRefState } from '@/hooks/common/useRefState';
import DeviceUtils from '@/core/utils/device';
import { RefreshAutoLockBottomSheetBackdrop } from '@/components/patches/refreshAutoLockUI';
import AutoLockView from '@/components/AutoLockView';
import { globalSetActiveDappState } from '@/core/bridges/state';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNavControl2 } from '@/components/WebView/DappWebViewControl2/Widgets';
import { IS_ANDROID } from '@/core/native/utils';
import { toast } from '@/components/Toast';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

const renderBackdrop = (props: Omit<BottomSheetBackdropProps, 'style'>) => {
  // const { colors2024 } = useTheme2024();
  return (
    <RefreshAutoLockBottomSheetBackdrop
      {...props}
      // style={undefined}
      disappearsOnIndex={0}
      appearsOnIndex={1}
    />
  );
};

/**
 * @description make sure put this Component under BottomSheetView
 */
function WebViewControlHeader({ headerNode }: { headerNode: React.ReactNode }) {
  const { animatedIndex, animatedPosition } = useBottomSheet();
  const { handlePanGestureHandler } = useBottomSheetGestureHandlers();

  const panGesture = useMemo(() => {
    let gesture = Gesture.Pan()
      .enabled(true)
      .shouldCancelWhenOutside(false)
      .runOnJS(false)
      .onStart((...args) => {
        runOnJS(globalSetActiveDappState)({ isPanning: true });
        return handlePanGestureHandler.handleOnStart(...args);
      })
      .onChange(handlePanGestureHandler.handleOnChange)
      .onEnd(handlePanGestureHandler.handleOnEnd)
      .onFinalize((evt, success) => {
        runOnJS(globalSetActiveDappState)({ isPanning: false }, { delay: 250 });
        return handlePanGestureHandler.handleOnFinalize(evt);
      });

    return gesture;
  }, [
    handlePanGestureHandler,
    // handlePanGestureHandler.handleOnStart,
    // handlePanGestureHandler.handleOnChange,
    // handlePanGestureHandler.handleOnEnd,
    // handlePanGestureHandler.handleOnFinalize,
  ]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View>
        <Animated.View
          key="BottomSheetHandleContainer"
          accessible={true}
          accessibilityRole="adjustable"
          accessibilityLabel="Bottom Sheet handle"
          accessibilityHint="Drag up or down to extend or minimize the Bottom Sheet">
          <AppBottomSheetHandle
            animatedIndex={animatedIndex}
            animatedPosition={animatedPosition}
            style={{
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
            }}
          />
        </Animated.View>
        <Animated.View
          key="DappAppControlBottomSheetHandleContainer"
          accessible={true}
          accessibilityRole="adjustable"
          accessibilityLabel="Bottom Sheet handle"
          accessibilityHint="Drag up or down to extend or minimize the Bottom Sheet">
          {headerNode}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const isIOS = Platform.OS === 'ios';
function useForceExpandOnceOnBootstrap(
  sheetModalRef: React.RefObject<OpenedDappBottomSheetModal> | null,
) {
  const { stateRef: firstTouchedRef, setRefState: setFirstTouched } =
    useRefState(false);

  useEffect(() => {
    (async () => {
      if (!firstTouchedRef.current && OPEN_DAPP_VIEW_INDEXES.expanded > 0) {
        sheetModalRef?.current?.present();
        sheetModalRef?.current?.expand({ duration: 0 });
        // sheetModalRef?.current?.snapToIndex(OPEN_DAPP_VIEW_INDEXES.expanded);

        firstTouchedRef.current = true;

        setTimeout(() => {
          sheetModalRef?.current?.forceClose();
          sheetModalRef?.current?.dismiss({ duration: 0 });

          setFirstTouched(true, true);
        }, 200);
      }
    })();
  }, [firstTouchedRef, setFirstTouched, sheetModalRef]);
}

function getDefaultSnapPoints() {
  const scrLayout = Dimensions.get('screen');
  const winLayout = Dimensions.get('window');

  return {
    scrLayout,
    fromScreen: [
      Math.max(1, Math.floor(scrLayout.height * 0.01)),
      parseFloat(scrLayout.height.toFixed(2)),
    ],
    winLayout,
    fromWindow: [
      Math.max(1, Math.floor(winLayout.height * 0.01)),
      parseFloat(winLayout.height.toFixed(2)),
    ],
  } as const;
}
// const DEFAULT_RANGES = getDefaultSnapPoints().fromScreen;
// const DEFAULT_RANGES = ['1%', '100%'];
function useSafeSizes() {
  const { top } = useSafeAreaInsets();

  const { snapPoints, webviewMaxHeight, containerPaddingTop } = useMemo(() => {
    const defaultSp = getDefaultSnapPoints();
    const fromScreen = defaultSp.fromScreen;

    const offTop = IS_ANDROID ? top + 0 : 0;
    const pt = IS_ANDROID ? 0 : top;

    return {
      snapPoints: [fromScreen[0], fromScreen[1] - offTop],
      webviewMaxHeight:
        defaultSp.scrLayout.height -
        ScreenLayouts2.dappWebViewControlHeaderHeight -
        ScreenLayouts2.dappWebViewControlNavHeight,
      containerPaddingTop: pt,
    };
  }, [top]);

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPaddingBottom: 0,
  });

  return {
    snapPoints,
    webviewMaxHeight,
    containerPaddingTop,
    containerPaddingBottom: safeSizes.containerPaddingBottom,
  };
}
export function OpenedDappWebViewStub() {
  const { colors, colors2024, styles } = useTheme2024({
    getStyle: getWebViewStubStyles,
  });
  const {
    openedDappItems,
    activeDapp,
    expandDappWebViewModal,
    collapseDappWebViewModal,
    closeOpenedDapp,
    onHideActiveDapp,
    closeActiveOpenedDapp,
  } = useOpenDappView();

  const {
    sheetModalRefs: { openedDappWebviewSheetModalRef },
  } = useActiveViewSheetModalRefs();

  const activeDappWebViewControlRef = useRef<DappWebViewControl2Type>(null);

  useForceExpandOnceOnBootstrap(openedDappWebviewSheetModalRef);

  const { isDappConnected, disconnectDapp, updateFavorite } = useDapps();

  const hideDappSheetModal = useCallback(() => {
    collapseDappWebViewModal();
    onHideActiveDapp();
  }, [collapseDappWebViewModal, onHideActiveDapp]);

  const handleBottomSheetChanges = useCallback<
    BottomSheetModalProps['onChange'] & object
  >(
    (index, pos, type) => {
      devLog(
        '[OpenedDappWebViewStub::handleBottomSheetChanges] index: %s; pos: %s; type: %s',
        index,
        pos,
        type,
      );
      if (index <= OPEN_DAPP_VIEW_INDEXES.collapsed) {
        /**
         * If `enablePanDownToClose` set as true, Dont call this method which would lead 'close' modal,
         * it will umount children component of BottomSheetModal
         */
        onHideActiveDapp();
      }
    },
    [onHideActiveDapp],
  );

  useEffect(() => {
    if (activeDapp) {
      expandDappWebViewModal();
    }
  }, [expandDappWebViewModal, activeDapp]);

  React.useEffect(() => {
    if (!openedDappItems.length || !activeDapp) {
      globalSetActiveDappState({ dappOrigin: null, tabId: null });
    }
  }, [openedDappItems.length, activeDapp]);

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      const control = activeDappWebViewControlRef.current;
      if (control?.getWebViewState().canGoBack) {
        control?.getWebViewActions().handleGoBack();
      } else if (activeDapp) {
        hideDappSheetModal();
      }
      return !activeDapp;
    }, [activeDapp, hideDappSheetModal]),
  );
  useFocusEffect(onHardwareBackHandler);

  const { currentAccount } = useCurrentAccount();
  const { RcWalletIcon } = useWalletBrandLogo(currentAccount?.brandName);

  const { handleChange } = useAutoLockBottomSheetModalOnChange(
    handleBottomSheetChanges,
  );

  const {
    snapPoints,
    webviewMaxHeight,
    containerPaddingTop,
    containerPaddingBottom,
  } = useSafeSizes();

  const hasOpenedDapps = !!openedDappItems.length;

  return (
    <OpenedDappBottomSheetModal
      index={OPEN_DAPP_VIEW_INDEXES.collapsed}
      {...(isIOS && { detached: false })}
      backdropComponent={renderBackdrop}
      enablePanDownToClose={false}
      // containerComponent={React.Fragment}
      containerStyle={{
        ...(hasOpenedDapps && {
          height: '100%',
          backgroundColor: 'transparent',
          // ...makeDevOnlyStyle({
          //   backgroundColor: 'red',
          // }),
        }),
      }}
      handleStyle={{ height: 0 }}
      backgroundStyle={styles.modalBg}
      name="openedDappWebviewSheetModalRef"
      ref={openedDappWebviewSheetModalRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      onChange={handleChange}>
      <AutoLockView
        as="BottomSheetView"
        style={[
          styles.bsView,
          !!openedDappItems.length && styles.bsViewOpened,
          {
            paddingTop: containerPaddingTop,
            paddingBottom: containerPaddingBottom,
          },
        ]}>
        {!openedDappItems.length && (
          <BottomSheetHandlableView
            style={{
              height: '100%',
              width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text
              style={{
                color: __DEV__ ? colors['neutral-title1'] : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              No Dapp Opened, Pan down to close
            </Text>
          </BottomSheetHandlableView>
        )}
        {openedDappItems.map((dappInfo, idx) => {
          const isConnected = !!dappInfo && isDappConnected(dappInfo.origin);
          const isFavorited = dappInfo.maybeDappInfo?.isFavorite ?? false;
          const isActiveDapp = activeDapp?.origin === dappInfo.origin;
          const key = `${dappInfo.origin}-${dappInfo.dappTabId}-${idx}`;

          return (
            <DappWebViewControl2
              key={key}
              ref={inst => {
                if (isActiveDapp) {
                  globalSetActiveDappState({ dappOrigin: dappInfo.origin });
                  // @ts-expect-error
                  activeDappWebViewControlRef.current = inst;
                  const activeTabId = inst?.getWebViewId() ?? undefined;
                  globalSetActiveDappState({
                    dappOrigin: dappInfo.origin,
                    tabId: dappInfo.dappTabId,
                  });
                }
              }}
              style={[!isActiveDapp && { display: 'none' }]}
              dappOrigin={dappInfo.origin}
              dappTabId={dappInfo.dappTabId}
              initialUrl={dappInfo.$openParams?.initialUrl}
              onSelfClose={reason => {
                if (reason === 'phishing') {
                  closeOpenedDapp(dappInfo.origin);
                }
              }}
              webviewContainerMaxHeight={webviewMaxHeight}
              webviewProps={{
                /**
                 * @platform ios
                 */
                contentMode: 'mobile',
                /**
                 * set nestedScrollEnabled to true will cause custom animated gesture not working,
                 * but whatever, we CAN'T apply any type meaningful gesture to RNW
                 * @platform android
                 */
                nestedScrollEnabled: false,
                allowsInlineMediaPlayback: true,
                disableJsPromptLike: !isActiveDapp,
              }}
              headerRight={() => {
                if (!RcWalletIcon) return null;

                return (
                  <TouchableView
                    style={[
                      {
                        height: ScreenLayouts2.dappWebViewControlHeaderHeight,
                        justifyContent: 'center',
                      },
                    ]}
                    onPress={() => {
                      navigate(RootNames.StackAddress, {
                        screen: RootNames.CurrentAddress,
                        params: {
                          backToDappOnClose: activeDapp?.origin,
                        },
                      });

                      hideDappSheetModal();
                    }}>
                    <RcWalletIcon
                      width={24}
                      height={24}
                      className="rounded-[24px]"
                    />
                  </TouchableView>
                );
              }}
              onPressClose={ctx => {
                activeDappWebViewControlRef.current?.closeWebViewNavModal();

                hideDappSheetModal();
                closeActiveOpenedDapp();
              }}
              // headerNode={({ header }) => {
              //   return <WebViewControlHeader headerNode={header} />;
              // }}
              navControlContent={({ webviewState, webviewActions }) => {
                return (
                  <BottomNavControl2
                    webviewState={webviewState}
                    webviewActions={webviewActions}
                    isFavorited={isFavorited}
                    isConnected={isConnected}
                    onPressButton={ctx => {
                      switch (ctx.type) {
                        case 'disconnect': {
                          disconnectDapp(dappInfo.origin);
                          toast.success('Disconnected');
                          break;
                        }
                        case 'favorite': {
                          updateFavorite(dappInfo.origin, !isFavorited);
                          break;
                        }
                        default:
                          ctx.defaultAction(ctx);
                          break;
                      }
                    }}
                  />
                );
              }}
            />
          );
        })}
      </AutoLockView>
    </OpenedDappBottomSheetModal>
  );
}

const getWebViewStubStyles = createGetStyles2024(ctx => {
  return {
    modalBg: {
      paddingTop: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      backgroundColor: ctx.colors2024['neutral-InvertHighlight'],
    },
    bsView: {
      paddingVertical: 0,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      /** @why keep '100%' for iOS layout, but could set as windowHeight for Android */
      maxHeight: DeviceUtils.isAndroid()
        ? Dimensions.get('window').height
        : '100%',
      minHeight: 20,
      backgroundColor: 'transparent',
      // ...makeDebugBorder('black'),
    },
    bsViewOpened: {
      height: '100%',
    },
  };
});
