import TouchableView from '@/components/Touchable/TouchableView';
import { createGetStyles2024 } from '@/utils/styles';
import { ScreenLayouts2 } from '@/constant/layout';
import { useWalletBrandLogo } from '@/hooks/account';

import { useAccountSceneVisible } from '@/components/AccountSwitcher/hooks';
import { DappInfo } from '@/core/services/dappService';
import {
  isSameAccount,
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { useEffect } from 'react';

export function WebViewHeaderRight({
  activeDapp,
}: {
  activeDapp?: DappInfo | null;
}) {
  // const { currentAccount } = useCurrentAccount({ disableAutoFetch: true });
  const { finalSceneCurrentAccount } = useSceneAccountInfo({
    forScene: '@ActiveDappWebViewModal',
  });
  const lastUsedAccount =
    activeDapp?.currentAccount ?? finalSceneCurrentAccount;

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  useEffect(() => {
    if (!lastUsedAccount) return;
    if (isSameAccount(lastUsedAccount, finalSceneCurrentAccount)) return;

    switchSceneCurrentAccount('@ActiveDappWebViewModal', lastUsedAccount);
  }, [lastUsedAccount, finalSceneCurrentAccount, switchSceneCurrentAccount]);

  useEffect(() => {
    return () => {
      switchSceneCurrentAccount('@ActiveDappWebViewModal', null);
    };
  }, [switchSceneCurrentAccount]);

  const { RcWalletIcon } = useWalletBrandLogo(lastUsedAccount?.brandName);

  const { toggleSceneVisible } = useAccountSceneVisible(
    '@ActiveDappWebViewModal',
  );

  // TODO: check if openedDapp is active dapp;

  if (!RcWalletIcon) return null;

  return (
    <TouchableView
      style={[
        {
          height: ScreenLayouts2.dappWebViewControlHeaderHeight,
          justifyContent: 'center',
        },
      ]}
      onPress={() => {
        toggleSceneVisible('@ActiveDappWebViewModal', true);
      }}>
      <RcWalletIcon width={24} height={24} className="rounded-[24px]" />
    </TouchableView>
  );
}

export const getStyle = createGetStyles2024(ctx => {
  return {};
});
