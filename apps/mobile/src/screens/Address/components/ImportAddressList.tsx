import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import {
  ImportAddressSVG,
  PrivateKeySVG,
  SeedPhraseSVG,
} from '@/assets/icons/address';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useSetPasswordFirst } from '@/hooks/useLock';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
  walletItemDisabled: {
    opacity: 0.6,
  },
});

export const ImportAddressList = () => {
  const { shouldRedirectToSetPasswordBefore } = useSetPasswordFirst();

  const handlePrivateKey = React.useCallback(() => {
    if (
      shouldRedirectToSetPasswordBefore({
        screen: RootNames.ImportPrivateKey,
      })
    )
      return;

    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.ImportPrivateKey,
    });
  }, [shouldRedirectToSetPasswordBefore]);

  const handleSeedPhrase = React.useCallback(() => {
    if (
      shouldRedirectToSetPasswordBefore({
        screen: RootNames.ImportMnemonic,
      })
    )
      return;

    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.ImportMnemonic,
    });
  }, [shouldRedirectToSetPasswordBefore]);

  return (
    <View>
      <WalletHeadline Icon={ImportAddressSVG}>Import an Address</WalletHeadline>
      <WalletItem
        style={styles.walletItem}
        Icon={SeedPhraseSVG}
        title="Import Seed Phrase"
        onPress={handleSeedPhrase}
      />
      <WalletItem
        style={styles.walletItem}
        Icon={PrivateKeySVG}
        title="Import Private Key"
        onPress={handlePrivateKey}
      />
    </View>
  );
};
