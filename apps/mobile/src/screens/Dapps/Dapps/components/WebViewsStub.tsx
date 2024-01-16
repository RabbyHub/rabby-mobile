import { useCallback, useEffect, useMemo } from 'react';
import { BackHandler } from 'react-native';
import { AppBottomSheetModal } from '@/components';
import {
  useOpenUrlView,
  useOpenDappView,
  useActiveViewSheetModalRefs,
} from '../../hooks/useDappView';
import SheetDappWebViewInner from './SheetDappWebView';
import SheetGeneralWebView from './SheetGeneralWebView';
import { devLog } from '@/utils/logger';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={0} appearsOnIndex={1} />
);

export function OpenedDappWebViewStub() {
  const { openedDappItems, activeDapp, hideActiveDapp } = useOpenDappView();

  const {
    sheetModalRefs: { dappWebviewContainerRef },
    toggleShowSheetModal,
  } = useActiveViewSheetModalRefs();

  const { safeOffScreenTop } = useSafeSizes();
  const { snapPoints, indexAsExpanded, indexAsCollapsed } = useMemo(() => {
    const range = ['1%', safeOffScreenTop];
    return {
      snapPoints: range,
      indexAsExpanded: range.length - 1,
      indexAsCollapsed: 0,
    };
  }, [safeOffScreenTop]);

  const handleBottomSheetChanges = useCallback(
    (index: number) => {
      devLog('OpenedDappWebViewStub::handleBottomSheetChanges', index);
      if (index <= indexAsCollapsed) {
        /**
         * If `enablePanDownToClose` set as true, Dont call this method which would lead 'close' modal,
         * it will umount children component of BottomSheetModal
         */
        toggleShowSheetModal('dappWebviewContainerRef', 0);
        hideActiveDapp();
      }
    },
    [toggleShowSheetModal, hideActiveDapp, indexAsCollapsed],
  );

  useEffect(() => {
    if (activeDapp) {
      toggleShowSheetModal('dappWebviewContainerRef', 1);
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
    <AppBottomSheetModal
      index={indexAsExpanded}
      // detached={true}
      // bottomInset={safeOffBottom}
      backdropComponent={renderBackdrop}
      enableContentPanningGesture={false}
      enablePanDownToClose={false}
      enableHandlePanningGesture
      name="dappWebviewContainerRef"
      ref={dappWebviewContainerRef}
      snapPoints={snapPoints}
      onChange={handleBottomSheetChanges}>
      <BottomSheetView className="px-[20] items-center justify-center">
        {openedDappItems.map((dappInfo, idx) => {
          const isActiveDapp = activeDapp?.origin === dappInfo.origin;
          const key = `${dappInfo.origin}-${
            dappInfo.maybeDappInfo?.chainId || 'ETH'
          }`;

          return (
            <SheetDappWebViewInner
              key={key}
              style={{ ...(!isActiveDapp && { display: 'none' }) }}
              dapp={dappInfo}
            />
          );
        })}
      </BottomSheetView>
    </AppBottomSheetModal>
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
