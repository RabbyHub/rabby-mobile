import { useState, useCallback, useEffect } from 'react';

import { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetModalsOnSettingScreen } from './hooks';
import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { devLog } from '@/utils/logger';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useSafeSizes } from '@/hooks/useAppLayout';
import AutoLockView from '@/components/AutoLockView';
import { RefreshAutoLockBottomSheetBackdrop } from '@/components/patches/refreshAutoLockUI';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <RefreshAutoLockBottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
  />
);

const TEST_DAPP_URL = 'https://metamask.github.io/test-dapp';

export default function SheetWebViewTester() {
  const {
    sheetModalRefs: { webviewTesterRef },
    toggleShowSheetModal,
  } = useSheetModalsOnSettingScreen();

  const [showing, setShowing] = useState(false);
  const handleSheetChanges = useCallback(
    (index: number) => {
      devLog('handleSheetChanges', index);
      if (index === -1) {
        toggleShowSheetModal('webviewTesterRef', false);
        setShowing(false);
      } else {
        setShowing(true);
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
      <AutoLockView
        as="BottomSheetView"
        style={{
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {/* <DappWebViewControl dappId={'debank.com'} /> */}
        {/* <DappWebViewControl dappId={DEV_CONSOLE_URL} /> */}
        {/* <DappWebViewControl dappId={'http://192.168.0.12:3000'} /> */}
        <DappWebViewControl dappOrigin={TEST_DAPP_URL} />
      </AutoLockView>
    </AppBottomSheetModal>
  );
}
