import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, Platform, Text, View } from 'react-native';
import {
  useOpenUrlView,
  useOpenDappView,
  useActiveViewSheetModalRefs,
  OPEN_DAPP_VIEW_INDEXES,
} from '../../hooks/useDappView';
import { BottomSheetContent } from './DappWebViewControlWidgets';
import { devLog } from '@/utils/logger';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  BottomSheetBackdropProps,
  BottomSheetModalProps,
  useBottomSheet,
  useBottomSheetGestureHandlers,
} from '@gorhom/bottom-sheet';

import DappWebViewControl, {
  DappWebViewControlType,
} from '@/components/WebView/DappWebViewControl';
import { useDapps } from '@/hooks/useDapps';
import TouchableView from '@/components/Touchable/TouchableView';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';
import { BottomNavControl } from '@/components/WebView/Widgets';
import { RcIconDisconnect } from '@/assets/icons/dapp';
import { toast } from '@/components/Toast';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
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
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { useRefState } from '@/hooks/common/useRefState';
import DeviceUtils from '@/core/utils/device';
import { RefreshAutoLockBottomSheetBackdrop } from '@/components/patches/refreshAutoLockUI';
import AutoLockView from '@/components/AutoLockView';
import { globalSetActiveDappState } from '@/core/bridges/state';
import TouchableText from '@/components/Touchable/TouchableText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <RefreshAutoLockBottomSheetBackdrop
    {...props}
    disappearsOnIndex={0}
    appearsOnIndex={1}
  />
);

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

  return [
    Math.max(1, Math.floor(scrLayout.height * 0.01)),
    parseFloat(scrLayout.height.toFixed(2)),
  ] as const;
}
const DEFAULT_RANGES = getDefaultSnapPoints();
// const DEFAULT_RANGES = ['1%', '100%'];
function useSafeSnapshots() {
  const { top } = useSafeAreaInsets();

  const snapPoints = useMemo(() => {
    const presets = getDefaultSnapPoints();

    return [presets[0], Math.max(presets[1], DEFAULT_RANGES[1]) - top];
  }, [top]);

  return { snapPoints };
}
export function OpenedDappWebViewStub() {
  const { colors, styles } = useThemeStyles(getWebViewStubStyles);
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

  const activeDappWebViewControlRef = useRef<DappWebViewControlType>(null);

  useForceExpandOnceOnBootstrap(openedDappWebviewSheetModalRef);

  const { isDappConnected, disconnectDapp } = useDapps();

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

  const { snapPoints } = useSafeSnapshots();

  return (
    <OpenedDappBottomSheetModal
      index={OPEN_DAPP_VIEW_INDEXES.collapsed}
      {...(isIOS && { detached: false })}
      // bottomInset={safeOffBottom}
      backdropComponent={renderBackdrop}
      enablePanDownToClose={false}
      backgroundStyle={{
        backgroundColor: colors['neutral-bg1'],
      }}
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
          const isActiveDapp = activeDapp?.origin === dappInfo.origin;
          const key = `${dappInfo.origin}-${dappInfo.dappTabId}-${idx}`;

          return (
            <DappWebViewControl
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
              bottomNavH={
                isConnected
                  ? ScreenLayouts.dappWebViewNavBottomSheetHeight
                  : ScreenLayouts.inConnectedDappWebViewNavBottomSheetHeight
              }
              headerLeft={() => {
                if (!RcWalletIcon) return null;

                return (
                  <TouchableView
                    style={[
                      {
                        height: ScreenLayouts.dappWebViewControlHeaderHeight,
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

                // what: render for connected chain icon
                // if (!isConnected) return null;
                // if (!dappInfo.maybeDappInfo?.chainId) return null;

                // return (
                //   <TouchableView
                //     style={[
                //       {
                //         height: ScreenLayouts.dappWebViewControlHeaderHeight,
                //         justifyContent: 'center',
                //       },
                //     ]}
                //     onPress={() => {}}>
                //     <ChainIconImage
                //       chainEnum={dappInfo.maybeDappInfo?.chainId}
                //       size={24}
                //       width={24}
                //       height={24}
                //     />
                //   </TouchableView>
                // );
              }}
              headerNode={({ header }) => {
                return <WebViewControlHeader headerNode={header} />;
              }}
              bottomSheetContent={({ webviewState, webviewActions }) => {
                return (
                  <BottomSheetContent
                    dappInfo={dappInfo}
                    onPressCloseDapp={() => {
                      activeDappWebViewControlRef.current?.closeWebViewNavModal();

                      hideDappSheetModal();
                      closeActiveOpenedDapp();
                    }}
                    bottomNavBar={
                      <BottomNavControl
                        webviewState={webviewState}
                        webviewActions={webviewActions}
                        onPressHome={() => {
                          if (!activeDapp) return;

                          webviewActions.go(
                            canoicalizeDappUrl(activeDapp.origin).httpOrigin,
                          );
                        }}
                        onPressButton={ctx => {
                          ctx.defaultAction(ctx);

                          switch (ctx.type) {
                            case 'back':
                            case 'forward':
                            case 'reload':
                            case 'home':
                              activeDappWebViewControlRef.current?.closeWebViewNavModal();
                              break;
                            default:
                              break;
                          }
                        }}
                        afterNode={
                          <BottomNavControl.TouchableItem
                            disabled={!isConnected}
                            onPress={() => {
                              if (!isConnected) return;

                              disconnectDapp(dappInfo.origin);
                              toast.success('Disconnected');
                            }}>
                            <RcIconDisconnect
                              isActive={isConnected}
                              width={26}
                              height={26}
                            />
                          </BottomNavControl.TouchableItem>
                        }
                      />
                    }
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

const getWebViewStubStyles = createGetStyles(colors => {
  return {
    bsView: {
      alignItems: 'center',
      justifyContent: 'center',
      /** @why keep '100%' for iOS layout, but could set as windowHeight for Android */
      height: DeviceUtils.isAndroid()
        ? Dimensions.get('window').height
        : '100%',
      minHeight: 20,
      backgroundColor: 'transparent',
    },
    bsViewOpened: {
      height: '100%',
    },
  };
});
