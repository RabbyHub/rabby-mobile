import { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { devLog } from '@/utils/logger';
import {
  useActiveViewSheetModalRefs,
  useOpenUrlView,
} from '../../hooks/useDappView';
import { useSafeSizes } from '@/hooks/useAppLayout';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);

export default function SheetGeneralWebView({ url }: { url: string | null }) {
  const {
    sheetModalRefs: { urlWebviewContainerRef },
    toggleShowSheetModal,
  } = useActiveViewSheetModalRefs();
  const { removeOpenedUrl } = useOpenUrlView();

  const handleBottomSheetChanges = useCallback(
    (index: number) => {
      devLog('SheetGeneralWebView::handleBottomSheetChanges', index);
      if (index == -1) {
        toggleShowSheetModal('urlWebviewContainerRef', false);
        removeOpenedUrl?.();
      }
    },
    [toggleShowSheetModal, removeOpenedUrl],
  );

  useEffect(() => {
    if (!url) {
      toggleShowSheetModal('urlWebviewContainerRef', 'destroy');
    } else {
      toggleShowSheetModal('urlWebviewContainerRef', true);
    }
  }, [toggleShowSheetModal, url]);

  const { safeOffScreenTop } = useSafeSizes();

  if (!url) return null;

  return (
    <AppBottomSheetModal
      index={0}
      backdropComponent={renderBackdrop}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      name="urlWebviewContainerRef"
      ref={urlWebviewContainerRef}
      snapPoints={[safeOffScreenTop]}
      onChange={handleBottomSheetChanges}>
      <BottomSheetView className="px-[20] items-center justify-center">
        <DappWebViewControl
          dappId={url}
          bottomSheetContent={({ bottomNavBar }) => {
            return (
              <View>
                <View
                  style={{
                    paddingVertical: 8,
                    justifyContent: 'center',
                  }}>
                  <View className="flex-shrink-0">{bottomNavBar}</View>
                </View>
              </View>
            );
          }}
        />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}
