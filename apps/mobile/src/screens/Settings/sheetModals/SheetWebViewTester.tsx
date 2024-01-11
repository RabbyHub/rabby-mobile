import { useState, useCallback, useEffect } from 'react';

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
import type { DappInfo } from '@rabby-wallet/service-dapp';
import { useDapps } from '@/hooks/useDapps';
import { CHAINS_ENUM } from '@debank/common';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);

const DAPP_METAMASK_TEST_DAPP: DappInfo = {
  info: {
    // chain_ids: ['eth', 'scrl'],
    description: '',
    id: 'https://metamask.github.io',
    logo_url: '',
    name: 'Site not found · GitHub Pages',
    tags: [],
    user_range: 'User <100',
  },
  chainId: CHAINS_ENUM.ETH,
  isFavorite: true,
};

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

  const { dapps, addDapp } = useDapps();

  console.debug('[debug] dapps', dapps);

  useEffect(() => {
    if (!showing) false;
    if (dapps[DAPP_METAMASK_TEST_DAPP.info.id]) return;

    addDapp(DAPP_METAMASK_TEST_DAPP);
    console.debug('Now add DAPP_METAMASK_TEST_DAPP to dapps');
  }, [dapps, addDapp, showing]);

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
        {/* <DappWebViewControl dappId={'http://192.168.0.12:3000'} /> */}
        <DappWebViewControl dappId={TEST_DAPP_URL} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}
