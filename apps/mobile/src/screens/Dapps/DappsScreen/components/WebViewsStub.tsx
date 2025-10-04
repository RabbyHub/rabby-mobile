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
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  useOpenUrlView,
  useOpenDappView,
  useActiveViewSheetModalRefs,
  OPEN_DAPP_VIEW_INDEXES,
  DappWebViewHideContext,
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
import { ScreenLayouts2 } from '@/constant/layout';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';
import {
  AppBottomSheetHandle,
  BottomSheetHandlableView,
} from '@/components/customized/BottomSheetHandle';
import {
  OpenedDappBottomSheetModal,
  useAutoLockBottomSheetModalOnChange,
} from '@/components';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';
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
import { WebViewHeaderRight } from '@/components/WebView/DappWebViewControl2/WebViewHeaderRight';
import { AccountSwitcherModalInDappWebView } from '@/components/AccountSwitcher/Modal';

const revealedTopBackdropStyle = StyleSheet.flatten([
  {
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
]) as StyleProp<ViewStyle>;
const renderBackdrop = (
  props: Omit<BottomSheetBackdropProps, 'style'>,
  { shouldRevealTop }: { shouldRevealTop: boolean },
) => {
  return (
    <RefreshAutoLockBottomSheetBackdrop
      {...props}
      opacity={__DEV__ ? 0.8 : 0.5}
      pressBehavior={'collapse'}
      {...(shouldRevealTop && {
        style: revealedTopBackdropStyle,
      })}
      disappearsOnIndex={OPEN_DAPP_VIEW_INDEXES.collapsed}
      appearsOnIndex={OPEN_DAPP_VIEW_INDEXES.expanded}
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
/** @deprecated */
export function OpenedDappWebViewStub() {
  const { colors, colors2024, styles } = useTheme2024({
    getStyle: getWebViewStubStyles,
  });
  const {
    openingActiveDappRef,
    openedDappItems,
    finalActiveDappId,
    activeDapp,
    expandDappWebViewModal,
    collapseDappWebViewModal,
    closeOpenedDapp,
    clearActiveDappOrigin,
  } = useOpenDappView();

  const {
    sheetModalRefs: { openedDappWebviewSheetModalRef },
  } = useActiveViewSheetModalRefs();

  const activeDappWebViewControlRef = useRef<DappWebViewControl2Type>(null);

  // useForceExpandOnceOnBootstrap(openedDappWebviewSheetModalRef);

  const { isDappConnected, disconnectDapp, updateFavorite } = useDapps();

  const hideDappSheetModal = useCallback(
    (ctx?: DappWebViewHideContext) => {
      const { willClose } = collapseDappWebViewModal(ctx);
      if (!willClose) return;
      clearActiveDappOrigin();
    },
    [collapseDappWebViewModal, clearActiveDappOrigin],
  );

  const [sheetModalIndex, setSheetModalIndex] = useState(
    OPEN_DAPP_VIEW_INDEXES.collapsed,
  );
  const handleBottomSheetChanges = useCallback<
    BottomSheetModalProps['onChange'] & object
  >((index, pos, type) => {
    devLog(
      '[OpenedDappWebViewStub::handleBottomSheetChanges] index: %s; pos: %s; type: %s',
      index,
      pos,
      type,
    );
    setSheetModalIndex(index);
    if (index > OPEN_DAPP_VIEW_INDEXES.collapsed) {
      /**
       * If `enablePanDownToClose` set as true, Dont call this method which would lead 'close' modal,
       * it will umount children component of BottomSheetModal
       */
      // clearActiveDappOrigin();
    }
  }, []);

  const expandTimerRef = useRef<any>(null);
  useEffect(() => {
    const clearTimer = () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    };

    if (openedDappItems.length && activeDapp) {
      expandTimerRef.current = setTimeout(() => {
        clearTimer();
        expandDappWebViewModal();
      }, 50);

      return clearTimer;
    } else if (!openedDappItems.length || !activeDapp) {
      globalSetActiveDappState({ dappOrigin: null, tabId: null });
    }
  }, [expandDappWebViewModal, activeDapp, openedDappItems.length]);

  useHandleBackPressClosable(
    useCallback(() => {
      const control = activeDappWebViewControlRef.current;
      const state = control?.getWebViewState();

      if (state?.canGoBack) {
        control?.getWebViewActions().handleGoBack();
      } else if (activeDapp) {
        hideDappSheetModal({
          // webViewId: control?.getWebViewId(),
          dappOrigin: control?.getWebViewDappOrigin() || '',
          latestUrl: state?.url,
          webviewId: control?.getWebViewId(),
        });
      } else if (!openingActiveDappRef.current) {
        openedDappWebviewSheetModalRef?.current?.close();
      }
      return !activeDapp;
    }, [
      activeDapp,
      hideDappSheetModal,
      openingActiveDappRef,
      openedDappWebviewSheetModalRef,
    ]),
    { autoEffectEnabled: !!activeDapp },
  );

  const { handleChange } = useAutoLockBottomSheetModalOnChange(
    handleBottomSheetChanges,
  );

  const {
    snapPoints,
    webviewMaxHeight,
    containerPaddingTop,
    containerPaddingBottom,
  } = useSafeSizes();

  const hasOpenedDapps = !!openedDappItems.length && !!activeDapp;

  // const webviewKeys = useMemo(() => {
  //   return openedDappItems.map((dappInfo, idx) => {
  //     return `${dappInfo.origin}-${dappInfo.dappTabId}`;
  //   });
  // }, [openedDappItems]);
  // console.debug('openedDapp webviews keys', webviewKeys);

  return (
    <OpenedDappBottomSheetModal
      index={OPEN_DAPP_VIEW_INDEXES.collapsed}
      {...(isIOS && { detached: false })}
      // notice: this property is not reactive, once changed it, you need to reload app to make it work
      backdropComponent={props =>
        renderBackdrop(props, {
          shouldRevealTop:
            !activeDapp && sheetModalIndex > OPEN_DAPP_VIEW_INDEXES.collapsed,
        })
      }
      enablePanDownToClose={false}
      // containerComponent={React.Fragment}
      containerStyle={[
        styles.sheetModalContainerStyle,
        {
          ...(!hasOpenedDapps
            ? {}
            : {
                height: '100%',
                // ...makeDevOnlyStyle({
                //   backgroundColor: colors2024['brand-default'],
                // }),
              }),
        },
      ]}
      handleStyle={{ height: 0 }}
      backgroundStyle={[styles.modalBg]}
      style={[styles.sheetModal, !activeDapp && styles.bgMustBeTransparent]}
      name="openedDappWebviewSheetModalRef"
      ref={openedDappWebviewSheetModalRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      // animateOnMount={false}
      // animationConfigs={{ duration: 500 }}
      onChange={handleChange}>
      <AutoLockView
        as="BottomSheetView"
        style={[
          styles.bsView,
          // !!openedDappItems.length && styles.bsViewOpened,
          !activeDapp ? styles.bgMustBeTransparent : styles.bsViewOpened,
          {
            paddingTop: containerPaddingTop,
            paddingBottom: containerPaddingBottom,
            // ...makeDevOnlyStyle({
            ///  // backgroundColor: 'blue',
            //   // height: '100%'
            // })
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
          const key = `${dappInfo.origin}-${dappInfo.dappTabId}`;

          return (
            <DappWebViewControl2
              key={key}
              ref={inst => {
                if (isActiveDapp) {
                  globalSetActiveDappState({ dappOrigin: dappInfo.origin });
                  // @ts-expect-error
                  activeDappWebViewControlRef.current = inst;
                  // const activeTabId = inst?.getWebViewId() ?? undefined;
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
              headerRight={<WebViewHeaderRight activeDapp={activeDapp} />}
              onPressHeaderLeftClose={ctx => {
                hideDappSheetModal(ctx);
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
        {openedDappItems.length > 0 && activeDapp && (
          <AccountSwitcherModalInDappWebView
            activeDappId={finalActiveDappId}
            __IS_IN_SHEET_MODAL__
          />
        )}
      </AutoLockView>
    </OpenedDappBottomSheetModal>
  );
}

const getWebViewStubStyles = createGetStyles2024(ctx => {
  const bgMustBeTransparent = {
    backgroundColor: 'transparent',
  };
  return {
    bgMustBeTransparent,
    sheetModalContainerStyle: { ...bgMustBeTransparent },
    modalBg: {
      paddingTop: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      /**
       * warning: never set backgroundColor other than transparent,
       * or you will see it cover on top of the screens in some cases.
       *
       * only set background color when you need debug the layout
       */
      ...bgMustBeTransparent,
    },
    sheetModal: {
      backgroundColor: ctx.colors['neutral-bg-1'],
    },
    bsView: {
      position: 'relative',
      paddingVertical: 0,
      alignItems: 'center',
      justifyContent: 'center',
      // height: '100%',
      /** @why keep '100%' for iOS layout, but could set as windowHeight for Android */
      maxHeight: DeviceUtils.isAndroid()
        ? Dimensions.get('window').height
        : '100%',
      minHeight: 20,
      backgroundColor: ctx.colors['neutral-bg-1'],
      // ...makeDebugBorder('black'),
    },
    bsViewOpened: {
      height: '100%',
    },
  };
});
