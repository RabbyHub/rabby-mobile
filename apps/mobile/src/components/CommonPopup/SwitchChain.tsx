import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { WALLET_NAME } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';

export const SwitchChain: React.FC = () => {
  const { setTitle, account, setHeight } = useCommonPopupView();
  const { t } = useTranslation();

  React.useEffect(() => {
    setTitle(t('page.dashboard.hd.howToSwitch'));
    setHeight(420);
  }, []);

  const url = React.useMemo(() => {
    switch (account?.brandName) {
      case WALLET_NAME.MetaMask:
        return require('@/assets/images/wallet/switch-chain-metamask.png');
      case WALLET_NAME.TP:
        return require('@/assets/images/wallet/switch-chain-tp.png');
      case WALLET_NAME.imToken:
        return require('@/assets/images/wallet/switch-chain-imtoken.png');
      case WALLET_NAME.TRUSTWALLET:
        return require('@/assets/images/wallet/switch-chain-trustwallet.png');
      default:
        return require('@/assets/images/wallet/switch-chain-common.png');
    }
  }, [account?.brandName]);
  return (
    <View className="p-[10px]">
      <Image source={url} className="w-full" />
    </View>
  );
};
