import { Text } from '@/components';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
});

export const WalletConnectList = () => {
  const { isLoading, validServices } = useValidWalletServices();

  return (
    <View>
      <WalletHeadline>Mobile Wallet Apps</WalletHeadline>
      {isLoading ? <Text>Loading...</Text> : null}
      {validServices.map(service => (
        <WalletItem
          style={styles.walletItem}
          key={service.name}
          title={service.name}
          Icon={service.walletInfo.icon}
          onPress={() => {}}
        />
      ))}
    </View>
  );
};
