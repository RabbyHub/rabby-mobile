import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BackHandler } from 'react-native';
import { AppBottomSheetModal, Button } from '@/components';
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
      <Animated.View
        key="DappAppControlBottomSheetHandleContainer"
        accessible={true}
        accessibilityRole="adjustable"
        accessibilityLabel="Bottom Sheet handle"
        accessibilityHint="Drag up or down to extend or minimize the Bottom Sheet">
        {headerNode}
      </Animated.View>
    </GestureDetector>
  );
}

const renderMoreCardBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
  />
);

function useSizes (dappOrigin?: string) {
  const { isDappConnected } = useDapps();
  const { safeOffHeader } = useSafeSizes();

  const bottomNavH = dappOrigin && isDappConnected(dappOrigin)
  ? ScreenLayouts.dappWebViewNavBottomSheetHeight
  : ScreenLayouts.inConnectedDappWebViewNavBottomSheetHeight;

  return {
    bottomNavH,
    bottomMoreSheetModalSnapShots: [bottomNavH + safeOffHeader],
  }
}

function GlobalOpenedDappWebViews() {
  const {
    openedDappItems,
    activeOpenedDappItem,
    activeDapp,
    hideActiveDapp,
    closeActiveDapp
  } =
    useOpenDappView();

  const {
    sheetModalRefs: {
      dappWebviewBottomSheetModalRef,
      dappWebViewMoreCardRef,
    },
    toggleShowSheetModal,
  } = useActiveViewSheetModalRefs();

  const dappWebViewControlRef = useRef<DappWebViewControlType>(null);

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
    dappWebviewBottomSheetModalRef?.current?.snapToIndex(0);
  }, [dappWebviewBottomSheetModalRef]);

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
      toggleShowSheetModal('dappWebviewBottomSheetModalRef', 1);
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

  const { bottomMoreSheetModalSnapShots } = useSizes();

  const {
    activeDappWebviewState,
    activeDappWebviewActions,
  } = useMemo(() => {
    const webviewState = dappWebViewControlRef.current?.getWebViewState();
    const webviewActions = dappWebViewControlRef.current?.getWebViewActions();

    return {
      activeDappWebviewState: webviewState,
      activeDappWebviewActions: webviewActions,
    }
  }, [ activeOpenedDappItem?.origin, dappWebViewControlRef.current ]);

  console.log('[feat] activeOpenedDappItem', activeOpenedDappItem);
  console.log('[feat] activeDappWebviewState', activeDappWebviewState);

  return (
    <>
      <AppBottomSheetModal
        index={indexAsExpanded}
        // detached={true}
        // bottomInset={safeOffBottom}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={false}
        enableContentPanningGesture={false}
        enableHandlePanningGesture
        name="dappWebviewBottomSheetModalRef"
        ref={dappWebviewBottomSheetModalRef}
        snapPoints={snapPoints}
        onChange={handleBottomSheetChanges}>
        <BottomSheetView
          className="items-center justify-center"
          style={{
            height: '100%',
          }}>
          {openedDappItems.map((dappInfo, idx) => {
            const isConnected = !!dappInfo && isDappConnected(dappInfo.origin);
            const isActiveDapp = activeDapp?.origin === dappInfo.origin;
            const key = `${dappInfo.origin}-${
              dappInfo.maybeDappInfo?.chainId || 'ETH'
            }`;

            return (
              <DappWebViewControl
                key={key}
                ref={dappWebViewControlRef}
                style={[!isActiveDapp && { display: 'none' }]}
                dappOrigin={dappInfo.origin}
                initialUrl={dappInfo.$openParams?.initialUrl}
                isCustomMoreSheetModal
                onPressMore={() => {
                  toggleShowSheetModal('dappWebViewMoreCardRef', true);
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
              />
            );
          })}
        </BottomSheetView>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        index={0}
        backdropComponent={renderMoreCardBackdrop}
        enableContentPanningGesture={true}
        name="webviewNavRef"
        ref={dappWebViewMoreCardRef}
        handleHeight={28}
        snapPoints={bottomMoreSheetModalSnapShots}>
        <BottomSheetView className="px-[20] items-center justify-center">
          <BottomSheetContent
            openedDappItem={activeOpenedDappItem}
            onPressCloseDapp={() => {
              dappWebViewControlRef.current?.closeWebViewNavModal();
              hideDappSheetModal();
              closeActiveDapp();
            }}
            bottomNavBar={
              (activeDappWebviewState && activeDappWebviewActions && (
                <BottomNavControl
                  webviewState={activeDappWebviewState}
                  webviewActions={activeDappWebviewActions}
                  // onPressHome={() => {
                  //   if (!activeDapp) return;

                  //   webviewActions.go(
                  //     canoicalizeDappUrl(activeDapp.origin).httpOrigin,
                  //   );
                  // }}
                  // afterNode={
                  //   <BottomNavControl.TouchableItem
                  //     disabled={!isConnected}
                  //     onPress={() => {
                  //       if (!isConnected) return;

                  //       disconnectDapp(dappInfo.origin);
                  //       toast.success('Disconnected');
                  //     }}>
                  //     <RcIconDisconnect
                  //       isActive={isConnected}
                  //       width={26}
                  //       height={26}
                  //     />
                  //   </BottomNavControl.TouchableItem>
                  // }
                />
              ))
            }
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
}

export function OpenedDappWebViewStub() {
  return (
    <>
      <GlobalOpenedDappWebViews />
    </>
  )
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
