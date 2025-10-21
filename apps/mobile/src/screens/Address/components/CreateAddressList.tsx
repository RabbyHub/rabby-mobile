import {
  RcIcoAddSeed,
  RcIconAddCircle,
  RcIconCreateSeed,
} from '@/assets/icons/address';
import { RootNames } from '@/constant/layout';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { navigateDeprecated } from '@/utils/navigation';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { useTranslation } from 'react-i18next';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
  walletItemDisabled: {
    opacity: 0.6,
  },
});

export const CreateAddressList = () => {
  const { t } = useTranslation();
  const { seedPhraseList } = useSeedPhrase();

  const { shouldRedirectToSetPasswordBefore } = useSetPasswordFirst();
  const handleAddSeedPhrase = React.useCallback(() => {
    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.AddMnemonic,
    });
  }, []);

  const handleSeedPhrase = React.useCallback(() => {
    if (
      shouldRedirectToSetPasswordBefore({ screen: RootNames.PreCreateMnemonic })
    )
      return;

    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.PreCreateMnemonic,
    });
  }, [shouldRedirectToSetPasswordBefore]);

  const hadSeedPhrase = seedPhraseList.length > 0;

  return (
    <View>
      <WalletHeadline Icon={RcIconAddCircle}>
        {t('page.newAddress.createNewAddress')}
      </WalletHeadline>
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
        title={t('page.newAddress.createNewSeedPhrase')}
        onPress={handleSeedPhrase}
      />
    </View>
  );
};
