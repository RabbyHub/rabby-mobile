import { Text } from '@/components';
import { apisWalletConnect } from '@/core/apis';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { openWallet, WalletService } from '@/hooks/walletconnect/util';
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
  const [uriLoading, setUriLoading] = React.useState(false);
  const handlePress = React.useCallback(async (service: WalletService) => {
    setUriLoading(true);
    const uri = await apisWalletConnect.getUri(service.walletInfo.brand);
    if (uri) {
      openWallet(service, uri);
    }
    setUriLoading(false);
  }, []);

  return (
    <View>
      <WalletHeadline>Mobile Wallet Apps</WalletHeadline>
      {isLoading ? <Text>Loading...</Text> : null}
      {validServices.map(service => (
        <WalletItem
          disable={uriLoading}
          style={styles.walletItem}
          key={service.name}
          title={service.name}
          Icon={service.walletInfo.icon}
          onPress={() => handlePress(service)}
        />
      ))}
    </View>
  );
};
