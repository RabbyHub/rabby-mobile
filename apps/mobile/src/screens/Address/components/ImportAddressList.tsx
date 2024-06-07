import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import { ImportAddressSVG, PrivateKeySVG } from '@/assets/icons/address';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
  walletItemDisabled: {
    opacity: 0.6,
  },
});

export const ImportAddressList = () => {
  const handlePrivateKey = React.useCallback(() => {
    navigate(RootNames.StackAddress, {
      screen: RootNames.ImportPrivateKey,
    });
  }, []);

  return (
    <View>
      <WalletHeadline Icon={ImportAddressSVG}>Import an Address</WalletHeadline>
      <WalletItem
        style={styles.walletItem}
        Icon={PrivateKeySVG}
        title="Import Private Key"
        onPress={handlePrivateKey}
      />
    </View>
  );
};
