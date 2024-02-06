import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { apisWalletConnect } from '@/core/apis';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { openWallet } from '@/hooks/walletconnect/util';
import { eventBus, EVENTS } from '@/utils/events';
import { navigate } from '@/utils/navigation';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import { WalletSVG } from '@/assets/icons/address';
import { WALLETCONNECT_SESSION_STATUS_MAP } from '@rabby-wallet/eth-walletconnect-keyring/type';
import { toast, toastWithIcon } from '@/components/Toast';
import { WalletInfo } from '@/utils/walletInfo';
import { EmptyMobileWallet } from './EmptyMobileWallet';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
  toastIcon: {
    marginRight: 6,
  },
});

export const WalletConnectList = () => {
  const { isLoading, validServices } = useValidWalletServices();
  const [uriLoading, setUriLoading] = React.useState(false);
  const deepLinkRef = React.useRef<string>('');
  const handlePress = React.useCallback(async (service: WalletInfo) => {
    setUriLoading(true);
    const toastHide = toastWithIcon(() => (
      <ActivityIndicator style={styles.toastIcon} />
    ))(`Opening ${service.displayName}`, {
      duration: 100000,
      position: toast.positions.CENTER,
      hideOnPress: false,
    });
    const uri = await apisWalletConnect.getUri(service.brand);
    if (uri) {
      openWallet(service, uri);
      deepLinkRef.current = uri;
    }
    setUriLoading(false);
    toastHide();
  }, []);

  const handleConnected = React.useCallback((data: any) => {
    // fix: when ETH_ACCOUNTS_CHANGED will be triggered, it will also trigger this event, so we need to filter it
    if (!data.realBrandName) {
      return;
    }

    // replace realBrandName with build-in brandName
    data.realBrandName = data.brandName;

    if (data.status === WALLETCONNECT_SESSION_STATUS_MAP.CONNECTED) {
      const toastHide = toastWithIcon(() => (
        <ActivityIndicator style={styles.toastIcon} />
      ))('Importing', {
        duration: 100000,
        position: toast.positions.CENTER,
        hideOnPress: false,
      });
      apisWalletConnect
        .importAddress(data)
        .then(() => {
          toastHide();
          navigate(RootNames.StackAddress, {
            screen: RootNames.ImportSuccess,
            params: {
              address: data.address,
              brandName: data.brandName,
              realBrandName: data.realBrandName,
              deepLink: deepLinkRef.current,
            },
          });
        })
        .catch((err: any) => {
          console.error(err);
          toast.show(err.message);
        })
        .finally(() => {
          toastHide();
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
      {!validServices?.length && !isLoading && <EmptyMobileWallet />}
    </View>
  );
};
