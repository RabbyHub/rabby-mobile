import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BackHandler } from 'react-native';
import { AppBottomSheetHandle, OpenedDappBottomSheetModal } from '@/components';
import {
  useOpenUrlView,
  useOpenDappView,
  useActiveViewSheetModalRefs,
} from '../../hooks/useDappView';
import { BottomSheetContent } from './DappWebViewControlWidgets';
import SheetGeneralWebView from './SheetGeneralWebView';
import { devLog } from '@/utils/logger';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
  useBottomSheet,
  useBottomSheetGestureHandlers,
} from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';

import DappWebViewControl, {
  DappWebViewControlType,
} from '@/components/WebView/DappWebViewControl';
import { useDapps } from '@/hooks/useDapps';
import TouchableView from '@/components/Touchable/TouchableView';
import { ScreenLayouts } from '@/constant/layout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { BottomNavControl } from '@/components/WebView/Widgets';
import { RcIconDisconnect } from '@/assets/icons/dapp';
import { toast } from '@/components/Toast';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={0} appearsOnIndex={1} />
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
      .onStart(handlePanGestureHandler.handleOnStart)
      .onChange(handlePanGestureHandler.handleOnChange)
      .onEnd(handlePanGestureHandler.handleOnEnd)
      .onFinalize(handlePanGestureHandler.handleOnFinalize);

    return gesture;
  }, [
    handlePanGestureHandler.handleOnChange,
    handlePanGestureHandler.handleOnEnd,
    handlePanGestureHandler.handleOnFinalize,
    handlePanGestureHandler.handleOnStart,
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

export function OpenedDappWebViewStub() {
  const { openedDappItems, activeDapp, hideActiveDapp, closeActiveDapp } =
    useOpenDappView();

  const {
    sheetModalRefs: { openedDappWebviewSheetModalRef },
    toggleShowSheetModal,
  } = useActiveViewSheetModalRefs();

  const activeDappWebViewControlRef = useRef<DappWebViewControlType>(null);

  const { safeOffScreenTop } = useSafeSizes();
  const { snapPoints, indexAsExpanded, indexAsCollapsed } = useMemo(() => {
    const range = ['1%', safeOffScreenTop];
    return {
      snapPoints: range,
      indexAsExpanded: range.length - 1,
      indexAsCollapsed: 0,
    };
  }, [safeOffScreenTop]);

  const { isDappConnected, disconnectDapp } = useDapps();

  const hideDappSheetModal = useCallback(() => {
    openedDappWebviewSheetModalRef?.current?.snapToIndex(0);
  }, [openedDappWebviewSheetModalRef]);

  const handleBottomSheetChanges = useCallback(
    (index: number) => {
      devLog('OpenedDappWebViewStub::handleBottomSheetChanges', index);
      if (index <= indexAsCollapsed) {
        /**
         * If `enablePanDownToClose` set as true, Dont call this method which would lead 'close' modal,
         * it will umount children component of BottomSheetModal
         */
        hideDappSheetModal();
        hideActiveDapp();
      }
    },
    [hideActiveDapp, hideDappSheetModal, indexAsCollapsed],
  );

  useEffect(() => {
    if (activeDapp) {
      toggleShowSheetModal('openedDappWebviewSheetModalRef', 1);
    }
  }, [toggleShowSheetModal, activeDapp]);

  const onFocusBackHandler = useCallback(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        /**
         * @see https://reactnavigation.org/docs/custom-android-back-button-handling/
         *
         * Returning true from onBackPress denotes that we have handled the event,
         * and react-navigation's listener will not get called, thus not popping the screen.
         *
         * Returning false will cause the event to bubble up and react-navigation's listener
         * will pop the screen.
         */
        return !!activeDapp;
      },
    );

    return () => subscription.remove();
  }, [activeDapp]);

  useFocusEffect(onFocusBackHandler);

  return (
    <OpenedDappBottomSheetModal
      index={indexAsExpanded}
      // detached={true}
      // bottomInset={safeOffBottom}
      backdropComponent={renderBackdrop}
      enablePanDownToClose={false}
      name="openedDappWebviewSheetModalRef"
      ref={openedDappWebviewSheetModalRef}
      snapPoints={snapPoints}
      onChange={handleBottomSheetChanges}>
      <BottomSheetView className="items-center justify-center h-[100%]">
        {openedDappItems.map((dappInfo, idx) => {
          const isConnected = !!dappInfo && isDappConnected(dappInfo.origin);
          const isActiveDapp = activeDapp?.origin === dappInfo.origin;
          const key = `${dappInfo.origin}-${
            dappInfo.maybeDappInfo?.chainId || 'ETH'
          }`;

          return (
            <DappWebViewControl
              key={key}
              ref={activeDappWebViewControlRef}
              style={[!isActiveDapp && { display: 'none' }]}
              dappOrigin={dappInfo.origin}
              initialUrl={dappInfo.$openParams?.initialUrl}
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
              }}
              bottomNavH={
                isConnected
                  ? ScreenLayouts.dappWebViewNavBottomSheetHeight
                  : ScreenLayouts.inConnectedDappWebViewNavBottomSheetHeight
              }
              headerLeft={() => {
                if (!isConnected) return null;
                if (!dappInfo.maybeDappInfo?.chainId) return null;

                return (
                  <TouchableView
                    style={[
                      {
                        height: ScreenLayouts.dappWebViewControlHeaderHeight,
                        justifyContent: 'center',
                      },
                    ]}
                    onPress={() => {}}>
                    <ChainIconImage
                      chainEnum={dappInfo.maybeDappInfo?.chainId}
                      size={24}
                      width={24}
                      height={24}
                    />
                  </TouchableView>
                );
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
                      closeActiveDapp();
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
      </BottomSheetView>
    </OpenedDappBottomSheetModal>
  );
}

/**
 * @deprecated
 */
export function OpenedWebViewsStub() {
  const { openedNonDappOrigin } = useOpenUrlView();

  if (!openedNonDappOrigin) return null;

  return (
    <>
      {[openedNonDappOrigin].map((url, idx) => {
        return <SheetGeneralWebView key={`${url}-${idx}`} url={url} />;
      })}
    </>
  );
}
