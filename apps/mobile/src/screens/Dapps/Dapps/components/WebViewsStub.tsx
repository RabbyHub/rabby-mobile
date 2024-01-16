import { useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
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
          const key = `${dappInfo.origin}-${dappInfo.chainId}`;

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
