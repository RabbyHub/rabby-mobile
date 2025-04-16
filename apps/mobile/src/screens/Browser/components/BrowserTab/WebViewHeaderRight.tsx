import TouchableView from '@/components/Touchable/TouchableView';
import { createGetStyles2024 } from '@/utils/styles';
import { ScreenLayouts2 } from '@/constant/layout';
import { useCurrentAccount, useWalletBrandLogo } from '@/hooks/account';

import { useAccountSceneVisible } from '@/components/AccountSwitcher/hooks';
import { DappInfo } from '@/core/services/dappService';
import {
  isSameAccount,
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { useEffect } from 'react';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { RcWalletCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';

export function WebViewHeaderRight({
  activeDapp,
}: {
  activeDapp: DappInfo | null;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { finalSceneCurrentAccount, sceneCurrentAccount } = useSceneAccountInfo(
    {
      forScene: '@ActiveDappWebViewModal',
    },
  );

  const { toggleSceneVisible } = useAccountSceneVisible(
    '@ActiveDappWebViewModal',
  );

  // TODO: check if openedDapp is active dapp;
  if (!finalSceneCurrentAccount) return null;

  return (
    <TouchableView
      style={[
        {
          height: ScreenLayouts2.dappWebViewControlHeaderHeight,
          justifyContent: 'center',
        },
      ]}
      onPress={() => {
        toggleSceneVisible('@ActiveDappWebViewModal');
      }}>
      {!sceneCurrentAccount ? (
        <RcWalletCC style={styles.walletIcon} />
      ) : (
        <WalletIcon
          type={finalSceneCurrentAccount?.type}
          width={24}
          height={24}
          style={{ borderRadius: 6 }}
        />
      )}
    </TouchableView>
  );
}

export const getStyle = createGetStyles2024(ctx => {
  return {
    walletIcon: {
      color: ctx.colors['neutral-title-1'],
      width: 24,
      height: 24,
    },
  };
});
