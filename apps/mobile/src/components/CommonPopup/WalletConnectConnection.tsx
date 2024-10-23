import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { useDisplayBrandName } from '@/hooks/walletconnect/useDisplayBrandName';
import { createGetStyles } from '@/utils/styles';
import { getWalletIcon } from '@/utils/walletInfo';
import { Text, View } from 'react-native';
import { useThemeStyles } from '@/hooks/theme';
import { Divide } from '../Approval/components/Actions/components/Divide';
import { FooterButton } from '../FooterButton/FooterButton';
import React from 'react';
import { useConnectWallet } from '@/hooks/walletconnect/useConnectWallet';

const getStyles = createGetStyles(colors => ({
  root: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },

  headline: {
    fontSize: 20,
    color: colors['neutral-title-1'],
    marginTop: 12,
    fontWeight: '500',
  },

  description: {
    fontSize: 16,
    color: colors['neutral-body'],
    marginTop: 12,
  },
}));

export const WalletConnectConnection = () => {
  const { account, closePopup } = useCommonPopupView();
  const WalletIcon = getWalletIcon(account?.brandName);
  const [displayBrandName] = useDisplayBrandName(
    account!.brandName,
    account!.address,
  );
  const { styles } = useThemeStyles(getStyles);
  const connectWallet = useConnectWallet();

  const onConnect = React.useCallback(() => {
    connectWallet(account!).then(() => {
      closePopup();
    });
  }, [account, connectWallet, closePopup]);

  return (
    <View>
      <View style={styles.root}>
        <WalletIcon height={50} width={50} />
        <Text style={styles.headline}>Connect {displayBrandName}</Text>
        <Text style={styles.description}>
          Your {displayBrandName} is not connected
        </Text>
      </View>
      <FooterButton title="Connect" onPress={onConnect} />
    </View>
  );
};
