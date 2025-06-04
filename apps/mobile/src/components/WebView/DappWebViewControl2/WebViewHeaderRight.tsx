import TouchableView from '@/components/Touchable/TouchableView';
import { ScreenLayouts2 } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';

import { RcWalletCC } from '@/assets/icons/common';
import { useAccountSceneVisible } from '@/components/AccountSwitcher/hooks';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { DappInfo } from '@/core/services/dappService';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
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
          address={finalSceneCurrentAccount?.address}
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
