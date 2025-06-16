import * as React from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { atom, useAtomValue } from 'jotai';
import { useSheetModals } from '@/hooks/useSheetModal';
import { useDapps } from '@/hooks/useDapps';
import { DappInfo } from '@/core/services/dappService';
import { CHAINS_ENUM } from '@/constant/chains';
import { useOpenDappView } from '@/screens/Dapps/hooks/useDappView';

export const sheetModalRefAtom = atom({
  webviewTesterRef: React.createRef<BottomSheetModal>(),
});

export function useSheetModalsOnSettingScreen() {
  const sheetModals = useAtomValue(sheetModalRefAtom);

  return useSheetModals(sheetModals);
}

export const DAPP_METAMASK_TEST_DAPP: DappInfo = {
  name: 'MetaMask Test Dapp',
  info: {
    chain_ids: ['eth', 'scrl'],
    description: '',
    id: 'https://metamask.github.io',
    logo_url: '',
    name: 'Site not found · GitHub Pages',
    tags: [],
    user_range: 'User <100',
  },
  origin: 'https://metamask.github.io',
  chainId: CHAINS_ENUM.ETH,
  isFavorite: true,
};

export function useSheetWebViewTester() {
  const { dapps, addDapp, updateFavorite } = useDapps();

  const { openUrlAsDapp } = useOpenDappView();

  const makeSureTestDapp = React.useCallback(() => {
    if (dapps[DAPP_METAMASK_TEST_DAPP.origin]) {
      updateFavorite(DAPP_METAMASK_TEST_DAPP.origin, true);
      return;
    }

    addDapp(DAPP_METAMASK_TEST_DAPP);
    console.debug('Now add DAPP_METAMASK_TEST_DAPP to dapps');
  }, [dapps, addDapp, updateFavorite]);

  // // leave here for debug
  // if (__DEV__) {
  //   console.debug(
  //     '[debug] useSheetWebViewTester:: dapps',
  //     Object.keys(dapps),
  //     dapps[DAPP_METAMASK_TEST_DAPP.origin],
  //   )
  // }

  const openMetaMaskTestDapp = React.useCallback(() => {
    makeSureTestDapp();

    openUrlAsDapp(
      {
        dappTabId: DAPP_METAMASK_TEST_DAPP.origin,
        openTime: Date.now(),
        origin: DAPP_METAMASK_TEST_DAPP.origin,
        $openParams: {
          initialUrl: 'https://metamask.github.io/test-dapp',
        },
      },
      { isActiveDapp: true, showSheetModalFirst: true },
    );
  }, [makeSureTestDapp, openUrlAsDapp]);

  return {
    makeSureTestDapp,
    openMetaMaskTestDapp,
  };
}
