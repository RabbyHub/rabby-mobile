import {
  RcIcoAddSeed,
  RcIconAddCircle,
  RcIconCreateSeed,
} from '@/assets/icons/address';
import { RootNames } from '@/constant/layout';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { navigate } from '@/utils/navigation';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import { useSetPasswordFirst } from '@/hooks/useLock';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
  walletItemDisabled: {
    opacity: 0.6,
  },
});

export const CreateAddressList = () => {
  const { seedPhraseList } = useSeedPhrase();

  const { shouldRedirectToSetPasswordBefore } = useSetPasswordFirst();
  const handleAddSeedPhrase = React.useCallback(() => {
    navigate(RootNames.StackAddress, {
      screen: RootNames.AddMnemonic,
    });
  }, []);

  const handleSeedPhrase = React.useCallback(() => {
    if (shouldRedirectToSetPasswordBefore(RootNames.CreateMnemonic)) return;

    navigate(RootNames.StackAddress, {
      screen: RootNames.CreateMnemonic,
    });
  }, [shouldRedirectToSetPasswordBefore]);

  const hadSeedPhrase = seedPhraseList.length > 0;

  return (
    <View>
      <WalletHeadline Icon={RcIconAddCircle}>Create new Address</WalletHeadline>
      {hadSeedPhrase && (
        <WalletItem
          style={styles.walletItem}
          Icon={RcIcoAddSeed}
          title="Add from Current Seed Phrase"
          onPress={handleAddSeedPhrase}
        />
      )}

      <WalletItem
        style={styles.walletItem}
        Icon={RcIconCreateSeed}
        title="Create New Seed Phrase"
        onPress={handleSeedPhrase}
      />
    </View>
  );
};
