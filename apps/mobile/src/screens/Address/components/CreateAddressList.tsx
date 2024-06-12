import { RcIconAddCircle, RcIconCreateSeed } from '@/assets/icons/address';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
  walletItemDisabled: {
    opacity: 0.6,
  },
});

export const CreateAddressList = () => {
  const handleSeedPhrase = React.useCallback(() => {
    navigate(RootNames.StackAddress, {
      screen: RootNames.CreateMnemonic,
    });
  }, []);

  return (
    <View>
      <WalletHeadline Icon={RcIconAddCircle}>Create new Address</WalletHeadline>
      <WalletItem
        style={styles.walletItem}
        Icon={RcIconCreateSeed}
        title="Create New Seed Phrase"
        onPress={handleSeedPhrase}
      />
    </View>
  );
};
