import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { Platform } from 'react-native';
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

import DappWebViewControl, {
  DappWebViewControlType,
} from '@/components/WebView/DappWebViewControl';
import { useDapps } from '@/hooks/useDapps';
import TouchableView from '@/components/Touchable/TouchableView';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { BottomNavControl } from '@/components/WebView/Widgets';
import { RcIconDisconnect } from '@/assets/icons/dapp';
import { toast } from '@/components/Toast';
import { canoicalizeDappUrl } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useCurrentAccount, useWalletBrandLogo } from '@/hooks/account';
import { navigate } from '@/utils/navigation';
import { AppBottomSheetHandle } from '@/components/customized/BottomSheetHandle';
import { OpenedDappBottomSheetModal } from '@/components';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { useFocusEffect } from '@react-navigation/native';

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

const isIOS = Platform.OS === 'ios';
function useForceExpandOnceOnBootstrap(
  sheetModalRef: React.RefObject<OpenedDappBottomSheetModal> | null,
) {
  const [firstTouched, setFirstTouched] = useState(false);
  const haventOpenedRef = useRef(true);
  useEffect(() => {
    if (haventOpenedRef.current && INDEX_AS_EXPANDED > 0) {
      sheetModalRef?.current?.present();
      sheetModalRef?.current?.snapToIndex(INDEX_AS_EXPANDED);
      setTimeout(() => {
        sheetModalRef?.current?.forceClose();
        haventOpenedRef.current = false;
        sheetModalRef?.current?.dismiss();
        setFirstTouched(true);
      }, 200);
    }
  }, [sheetModalRef]);

  return {
    firstTouched,
  };
}

const DEFAULT_RANGES = ['1%', '100%'];
const INDEX_AS_EXPANDED = 1;
const INDEX_AS_COLLAPSED = 0;
export function OpenedDappWebViewStub() {
  const { openedDappItems, activeDapp, hideActiveDapp, closeActiveOpenedDapp } =
    useOpenDappView();

  const {
    sheetModalRefs: { openedDappWebviewSheetModalRef },
    toggleShowSheetModal,
  } = useActiveViewSheetModalRefs();

  const activeDappWebViewControlRef = useRef<DappWebViewControlType>(null);

  const { safeOffScreenTop } = useSafeSizes();
  const snapPoints = useMemo(() => {
    return [DEFAULT_RANGES[0], safeOffScreenTop];
  }, [safeOffScreenTop]);

  useForceExpandOnceOnBootstrap(openedDappWebviewSheetModalRef);

  const { isDappConnected, disconnectDapp } = useDapps();

  const hideDappSheetModal = useCallback(() => {
    openedDappWebviewSheetModalRef?.current?.snapToIndex(0);
    hideActiveDapp();
  }, [openedDappWebviewSheetModalRef, hideActiveDapp]);

  const handleBottomSheetChanges = useCallback(
    (index: number) => {
      devLog('OpenedDappWebViewStub::handleBottomSheetChanges', index);
      if (index <= INDEX_AS_COLLAPSED) {
        /**
         * If `enablePanDownToClose` set as true, Dont call this method which would lead 'close' modal,
         * it will umount children component of BottomSheetModal
         */
        hideDappSheetModal();
      }
    },
    [hideDappSheetModal],
  );

  useEffect(() => {
    if (activeDapp) {
      // openedDappWebviewSheetModalRef?.current?.snapToIndex(INDEX_AS_EXPANDED);
      // openedDappWebviewSheetModalRef?.current?.present();
      toggleShowSheetModal('openedDappWebviewSheetModalRef', INDEX_AS_EXPANDED);
      // toggleShowSheetModal('openedDappWebviewSheetModalRef', true);
    }
  }, [toggleShowSheetModal, activeDapp]);

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    useCallback(() => {
      const control = activeDappWebViewControlRef.current;
      if (control?.getWebViewState().canGoBack) {
        control?.getWebViewActions().handleGoBack();
      } else {
        // hideDappSheetModal();
      }
      return !activeDapp;
    }, [activeDapp]),
  );
  useFocusEffect(onHardwareBackHandler);

  const { currentAccount } = useCurrentAccount();
  const { RcWalletIcon } = useWalletBrandLogo(currentAccount?.brandName);

  return (
    <OpenedDappBottomSheetModal
      index={INDEX_AS_COLLAPSED}
      {...(isIOS && { detached: false })}
      // bottomInset={safeOffBottom}
      backdropComponent={renderBackdrop}
      enablePanDownToClose={false}
      name="openedDappWebviewSheetModalRef"
      ref={openedDappWebviewSheetModalRef}
      snapPoints={snapPoints}
      onChange={handleBottomSheetChanges}>
      <BottomSheetView
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 20,
        }}>
        {openedDappItems.map((dappInfo, idx) => {
          const isConnected = !!dappInfo && isDappConnected(dappInfo.origin);
          const isActiveDapp = activeDapp?.origin === dappInfo.origin;
          const key = `${dappInfo.origin}-${
            dappInfo.maybeDappInfo?.chainId || 'ETH'
          }-${idx}`;

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
