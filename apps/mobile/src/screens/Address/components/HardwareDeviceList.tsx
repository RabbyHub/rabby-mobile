import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import OneKeySVG from '@/assets/icons/wallet/onekey.svg';
import KeystoneSVG from '@/assets/icons/wallet/keystone.svg';
import { HardwareSVG } from '@/assets/icons/address';
import { toast } from '@/components/Toast';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
    opacity: 0.6,
  },
});

export const HardwareDeviceList = () => {
  const handleComingSoon = React.useCallback(() => {
    toast.show('Coming Soon :)');
  }, []);

  return (
    <View>
      <WalletHeadline Icon={HardwareSVG}>Hardware Wallets</WalletHeadline>
      <WalletItem
        style={styles.walletItem}
        Icon={LedgerSVG}
        title="Ledger"
        onPress={handleComingSoon}
      />
      <WalletItem
        style={styles.walletItem}
        Icon={OneKeySVG}
        title="OneKey"
        onPress={handleComingSoon}
      />
      <WalletItem
        style={styles.walletItem}
        Icon={KeystoneSVG}
        title="Keystone"
        onPress={handleComingSoon}
      />
    </View>
  );
};
