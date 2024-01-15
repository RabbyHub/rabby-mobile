import { useCallback, useEffect } from 'react';
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
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);

export function OpenedDappWebViewStub() {
  const { openedDappItems, activeDapp, hideActiveDapp } = useOpenDappView();

  const {
    sheetModalRefs: { dappWebviewContainerRef },
    toggleShowSheetModal,
  } = useActiveViewSheetModalRefs();

  const handleBottomSheetChanges = useCallback(
    (index: number) => {
      devLog('OpenedDappWebViewStub::handleBottomSheetChanges', index);
      if (index == -1) {
        toggleShowSheetModal('dappWebviewContainerRef', false);
        hideActiveDapp();
      }
    },
    [toggleShowSheetModal, hideActiveDapp],
  );

  useEffect(() => {
    if (!activeDapp) {
      toggleShowSheetModal('dappWebviewContainerRef', 'destroy');
    } else {
      toggleShowSheetModal('dappWebviewContainerRef', true);
    }
  }, [toggleShowSheetModal, activeDapp]);

  const { safeOffScreenTop } = useSafeSizes();

  return (
    <AppBottomSheetModal
      index={0}
      backdropComponent={renderBackdrop}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      name="dappWebviewContainerRef"
      ref={dappWebviewContainerRef}
      snapPoints={[safeOffScreenTop]}
      onChange={handleBottomSheetChanges}>
      <BottomSheetView className="px-[20] items-center justify-center">
        {openedDappItems.map((dappInfo, idx) => {
          const isActiveDapp = activeDapp?.origin === dappInfo.origin;
          const key = `${dappInfo.origin}-${dappInfo.chainId}-${idx}`;

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
