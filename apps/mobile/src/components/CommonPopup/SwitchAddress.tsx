import React from 'react';
import { useTranslation } from 'react-i18next';
import { WALLET_NAME } from '@rabby-wallet/keyring-utils/src/types';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { Image, View } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import AutoLockView from '../AutoLockView';

export const SwitchAddress: React.FC = () => {
  const { setTitle, account, setHeight } = useCommonPopupView();
  const { t } = useTranslation();

  React.useEffect(() => {
    setTitle(t('page.dashboard.hd.howToSwitch'));
    setHeight(420);
  }, [t, setTitle, setHeight]);

  const url = React.useMemo(() => {
    switch (account?.brandName) {
      case WALLET_NAME.MetaMask:
        return require('@/assets/images/wallet/switch-address-metamask.png');
      case WALLET_NAME.TP:
        return require('@/assets/images/wallet/switch-address-tp.png');
      case WALLET_NAME.imToken:
        return require('@/assets/images/wallet/switch-address-imtoken.png');
      case WALLET_NAME.TRUSTWALLET:
        return require('@/assets/images/wallet/switch-address-trustwallet.png');
      default:
        return require('@/assets/images/wallet/switch-address-common.png');
    }
  }, [account?.brandName]);

  return (
    <AutoLockView as="BottomSheetView">
      <Image
        source={url}
        resizeMode="contain"
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </AutoLockView>
  );
};
