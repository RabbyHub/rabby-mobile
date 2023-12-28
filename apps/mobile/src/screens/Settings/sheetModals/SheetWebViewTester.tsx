import { useCallback } from 'react';

import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSheetModalsOnSettingScreen } from './hooks';
import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { devLog } from '@/utils/logger';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { DEV_CONSOLE_URL } from '@/constant/env';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);

export default function SheetWebViewTester() {
  const {
    sheetModalRefs: { webviewTesterRef },
    toggleShowSheetModal,
  } = useSheetModalsOnSettingScreen();

  const handleSheetChanges = useCallback(
    (index: number) => {
      devLog('handleSheetChanges', index);
      if (index === -1) {
        toggleShowSheetModal('webviewTesterRef', false);
      }
    },
    [toggleShowSheetModal],
  );

  const { safeOffScreenTop } = useSafeSizes();

  return (
    <AppBottomSheetModal
      backdropComponent={renderBackdrop}
      enableContentPanningGesture={false}
      ref={webviewTesterRef}
      snapPoints={[safeOffScreenTop]}
      onChange={handleSheetChanges}>
      <BottomSheetView className="px-[20] items-center justify-center">
        {/* <DappWebViewControl dappId={'debank.com'} /> */}
        {/* <DappWebViewControl dappId={DEV_CONSOLE_URL} /> */}
        <DappWebViewControl dappId={'http://192.168.0.12:3000'} />
        {/* <DappWebViewControl dappId={'https://metamask.github.io/test-dapp'} /> */}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}
