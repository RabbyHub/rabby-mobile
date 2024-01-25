import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { apisWalletConnect } from '@/core/apis';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { openWallet } from '@/hooks/walletconnect/util';
import { eventBus, EVENTS } from '@/utils/events';
import { navigate } from '@/utils/navigation';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import { WalletSVG } from '@/assets/icons/address';
import { WALLETCONNECT_SESSION_STATUS_MAP } from '@rabby-wallet/eth-walletconnect-keyring/type';
import { toast } from '@/components/Toast';
import { WalletInfo } from '@/utils/walletInfo';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
});

export const WalletConnectList = () => {
  const { isLoading, validServices } = useValidWalletServices();
  const [uriLoading, setUriLoading] = React.useState(false);
  const deepLinkRef = React.useRef<string>('');
  const handlePress = React.useCallback(async (service: WalletInfo) => {
    setUriLoading(true);
    const uri = await apisWalletConnect.getUri(service.brand);
    if (uri) {
      openWallet(service, uri);
      deepLinkRef.current = uri;
    }
    setUriLoading(false);
  }, []);

  const handleConnected = React.useCallback((data: any) => {
    if (data.status === WALLETCONNECT_SESSION_STATUS_MAP.CONNECTED) {
      apisWalletConnect
        .importAddress(data)
        .then(() => {
          navigate(RootNames.ImportSuccess, {
            address: data.address,
            brandName: data.brandName,
            realBrandName: data.realBrandName,
            deepLink: deepLinkRef.current,
          });
        })
        .catch((err: any) => {
          console.error(err);
          toast.show(err.message);
        });
    }
  }, []);

  React.useEffect(() => {
    eventBus.addListener(
      EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED,
      handleConnected,
    );

    return () => {
      eventBus.removeListener(
        EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED,
        handleConnected,
      );
    };
  }, [handleConnected]);

  return (
    <View>
      <WalletHeadline Icon={WalletSVG}>Mobile Wallet Apps</WalletHeadline>
      {isLoading ? <Text>Loading...</Text> : null}
      {validServices.map(service => (
        <WalletItem
          disable={uriLoading}
          style={styles.walletItem}
          key={service.displayName}
          title={service.displayName}
          Icon={service.icon}
          onPress={() => handlePress(service)}
        />
      ))}
    </View>
  );
};
