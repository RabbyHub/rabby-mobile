import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { apisWalletConnect } from '@/core/apis';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { openWallet, WalletService } from '@/hooks/walletconnect/util';
import { eventBus, EVENTS } from '@/utils/events';
import { navigate } from '@/utils/navigation';
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

  React.useEffect(() => {
    eventBus.addListener(EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED, data => {
      if (data.status === 'CONNECTED') {
        navigate(RootNames.ImportSuccess, {
          address: data.address,
          brandName: data.brandName,
          readBrandName: data.readBrandName,
        });
      }
    });
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
