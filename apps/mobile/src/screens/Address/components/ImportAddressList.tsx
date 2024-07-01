import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import {
  ImportAddressSVG,
  PrivateKeySVG,
  SeedPhraseSVG,
} from '@/assets/icons/address';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useLoadLockInfo, useSetPasswordFirst } from '@/hooks/useLock';
import { PasswordStatus } from '@/core/apis/lock';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useFocusEffect } from '@react-navigation/native';
import { SettingNavigatorParamList } from '@/navigation-type';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
  walletItemDisabled: {
    opacity: 0.6,
  },
});

export const ImportAddressList = () => {
  const navigation = useRabbyAppNavigation();

  const { shouldRedirectToSetPasswordBefore } = useSetPasswordFirst();

  const handlePrivateKey = React.useCallback(() => {
    if (shouldRedirectToSetPasswordBefore(RootNames.ImportPrivateKey)) return;

    navigate(RootNames.StackAddress, {
      screen: RootNames.ImportPrivateKey,
    });
  }, [shouldRedirectToSetPasswordBefore]);

  const handleSeedPhrase = React.useCallback(() => {
    if (shouldRedirectToSetPasswordBefore(RootNames.ImportMnemonic)) return;

    navigate(RootNames.StackAddress, {
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
