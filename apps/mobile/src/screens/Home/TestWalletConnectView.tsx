import { Button, Text } from '@/components';
import { apisWalletConnect } from '@/core/apis';
import { keyringService } from '@/core/services';
import { useAccounts } from '@/hooks/account';
import { useValidWalletServices } from '@/hooks/walletconnect/useValidWalletServices';
import { eventBus, EVENTS } from '@/utils/events';
import {
  WALLETCONNECT_SESSION_STATUS_MAP,
  WALLETCONNECT_STATUS_MAP,
} from '@rabby-wallet/eth-walletconnect-keyring/type';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { ToastAndroid, View } from 'react-native';

export function TestWalletConnectView() {
  const { accounts, fetchAccounts } = useAccounts();
  const { openWalletByBrandName } = useValidWalletServices();
  const lastAccount = React.useMemo(() => {
    return accounts.find(a => a.type === KEYRING_TYPE.WalletConnectKeyring);
  }, [accounts]);
  const [sessionStatus, setSessionStatus] =
    React.useState<keyof typeof WALLETCONNECT_SESSION_STATUS_MAP>();

  React.useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleConnect = async () => {
    if (!lastAccount) {
      return;
    }
    apisWalletConnect
      .getUri(lastAccount.brandName, 1, lastAccount)
      .then(uri => {
        if (uri) {
          openWalletByBrandName(lastAccount.brandName, uri);
        }
      });
  };

  const handleSignPersonalMessage = async () => {
    if (!lastAccount) {
      return;
    }
    const deepLink = await apisWalletConnect.getDeepLink(lastAccount);

    keyringService.signPersonalMessage(
      {
        from: lastAccount.address,
        data: '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765',
      },
      {
        brandName: lastAccount.brandName,
      },
    );

    if (deepLink) {
      openWalletByBrandName(lastAccount.brandName, deepLink);
    }
  };

  const handleStatusChanged = React.useCallback((data: any) => {
    if (data.status === WALLETCONNECT_STATUS_MAP.SIBMITTED) {
      ToastAndroid.show(`'submitted: ${data.payload}`, ToastAndroid.SHORT);
    }
  }, []);

  const handleSessionStatusChanged = React.useCallback((data: any) => {
    setSessionStatus(data.status);
  }, []);

  React.useEffect(() => {
    if (lastAccount) {
      apisWalletConnect.checkClientIsCreate(lastAccount).then(res => {
        setSessionStatus(res as any);
      });
    }
  }, [lastAccount]);

  React.useEffect(() => {
    eventBus.addListener(
      EVENTS.WALLETCONNECT.STATUS_CHANGED,
      handleStatusChanged,
    );

    eventBus.addListener(
      EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED,
      handleSessionStatusChanged,
    );

    return () => {
      eventBus.removeListener(
        EVENTS.WALLETCONNECT.STATUS_CHANGED,
        handleStatusChanged,
      );
      eventBus.removeListener(
        EVENTS.WALLETCONNECT.SESSION_STATUS_CHANGED,
        handleSessionStatusChanged,
      );
    };
  }, [handleSessionStatusChanged, handleStatusChanged]);

  return (
    lastAccount && (
      <View>
        <Text>aliasName: {lastAccount.aliasName}</Text>
        <Text>address: {lastAccount.address}</Text>
        <Text>brandName: {lastAccount.brandName}</Text>
        <Text>连接状态: {sessionStatus ?? '查询中'}</Text>
        <Button
          disabled={sessionStatus !== 'DISCONNECTED'}
          buttonStyle={{
            width: 100,
            height: 40,
            backgroundColor: 'green',
          }}
          title="连接"
          onPress={handleConnect}
        />
        <Button
          disabled={sessionStatus !== 'CONNECTED'}
          buttonStyle={{
            width: 100,
            height: 40,
            backgroundColor: 'orange',
          }}
          title="文本签名"
          onPress={handleSignPersonalMessage}
        />
      </View>
    )
  );
}
