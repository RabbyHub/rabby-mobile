import { WalletSVG } from '@/assets/icons/address';
import { Text } from '@/components';
import { toast, toastIndicator } from '@/components/Toast';
import { RootNames } from '@/constant/layout';
import { apisWalletConnect } from '@/core/apis';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { openWallet } from '@/hooks/walletconnect/util';
import { matomoRequestEvent } from '@/utils/analytics';
import { eventBus, EVENTS } from '@/utils/events';
import { navigate } from '@/utils/navigation';
import { WalletInfo } from '@/utils/walletInfo';
import { WALLETCONNECT_SESSION_STATUS_MAP } from '@rabby-wallet/eth-walletconnect-keyring/type';
import {
  KEYRING_CATEGORY,
  KEYRING_CLASS,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { useAppState } from '@react-native-community/hooks';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDuplicateAddressModal } from './DuplicateAddressModal';
import { EmptyMobileWallet } from './EmptyMobileWallet';
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
  const deepLinkRef = React.useRef<string>('');

  const isOpenWcRef = useRef(false);

  const hideImportLoadingTipRef = useRef<(() => void) | null>(null);
  const importingRef = useRef(false);

  const handlePress = React.useCallback(async (service: WalletInfo) => {
    matomoRequestEvent({
      category: 'Import Address',
      action: `Begin_Import_${KEYRING_CATEGORY.WalletConnect}`,
      label: service.brand,
    });

    setUriLoading(true);
    const toastHide = toastIndicator(`Opening ${service.displayName}`);
    const uri = await apisWalletConnect.getUri(service.brand);
    if (uri) {
      hideImportLoadingTipRef.current?.();
      openWallet(service, uri).then(() => {
        isOpenWcRef.current = true;
        importingRef.current = true;
      });
      deepLinkRef.current = uri;
    }
    setUriLoading(false);
    toastHide();
  }, []);

  const appState = useAppState();
  const isFocus = useIsFocused();

  const toastImportTip = React.useCallback(
    () =>
      toastIndicator('Importing', {
        duration: 6000,
        position: toast.positions.CENTER,
        hideOnPress: false,
      }),
    [],
  );

  useEffect(() => {
    if (isOpenWcRef.current && appState === 'active' && isFocus) {
      isOpenWcRef.current = false;
      hideImportLoadingTipRef.current = toastImportTip();
    }
  }, [appState, isFocus, toastImportTip]);

  useFocusEffect(() => {
    return () => {
      hideImportLoadingTipRef.current?.();
    };
  });

  const duplicateAddressModal = useDuplicateAddressModal();

  const handleConnected = React.useCallback(
    (data: any) => {
      // fix: when ETH_ACCOUNTS_CHANGED will be triggered, it will also trigger this event, so we need to filter it
      if (!data.realBrandName || !importingRef.current) {
        return;
      }

      // replace realBrandName with build-in brandName
      data.realBrandName = data.brandName;
      hideImportLoadingTipRef.current?.();
      const hideToast = toastImportTip();

      if (data.status === WALLETCONNECT_SESSION_STATUS_MAP.CONNECTED) {
        importingRef.current = false;

        apisWalletConnect
          .importAddress(data)
          .then(() => {
            hideToast();
            navigate(RootNames.StackAddress, {
              screen: RootNames.ImportSuccess,
              params: {
                type: KEYRING_TYPE.WalletConnectKeyring,
                address: data.address,
                brandName: data.brandName,
                realBrandName: data.realBrandName,
                deepLink: deepLinkRef.current,
              },
            });
          })
          .catch((err: any) => {
            if (err.name === 'DuplicateAccountError') {
              duplicateAddressModal.show({
                address: err.message,
                brandName: data.brandName,
                type: KEYRING_TYPE.WalletConnectKeyring,
              });
            } else {
              console.error(err);
              toast.show(err.message);
            }
          })
          .finally(() => {
            hideToast();
            eventBus.removeListener(
              EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED,
              handleConnected,
            );
          });
      }
    },
    [duplicateAddressModal, toastImportTip],
  );

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
