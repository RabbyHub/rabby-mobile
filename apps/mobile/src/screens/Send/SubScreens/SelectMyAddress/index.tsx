import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { FlatList, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { WhiteListItem } from '../../components/WhiteListItem';
import EmptyWhiteListHolder from '../../components/EmptyWhiteListHolder';
import { OtherAddressNav } from '@/screens/Address/AddressListScreen';
import { trigger } from 'react-native-haptic-feedback';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { useAccounts } from '@/hooks/account';
import { useWhitelist } from '@/hooks/whitelist';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/dist/types';

const triggerLight = () => {
  trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
};

const SelectMyAddressScreen = ({
  isForWhitelist,
}: {
  isForWhitelist: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { accounts: allAccounts } = useAccounts();
  const { whitelist } = useWhitelist();
  const { navigation } = useSafeSetNavigationOptions();
  const handleGotoImportedAddress = (type: 'watch' | 'safe') => {
    triggerLight();
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: isForWhitelist
          ? RootNames.TypeAddress2Whitelist
          : RootNames.SelectTypeAddress,
        params: { type },
      }),
    );
  };

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
      <FlatList
        data={allAccounts
          .filter(
            a =>
              a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
          )
          .sort((a, b) => (b.balance || 0) - (a.balance || 0))}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <WhiteListItem
              account={item}
              inWhiteList={whitelist.includes(item.address)}
              hiddenArrow
              isForWhitelist={isForWhitelist}
              disableMenu
            />
          </View>
        )}
        ListEmptyComponent={EmptyWhiteListHolder}
        ListFooterComponent={
          <View style={styles.footer}>
            {!!allAccounts.filter(acc => acc.type === KEYRING_CLASS.WATCH)
              .length && (
              <OtherAddressNav
                onPress={() => handleGotoImportedAddress('watch')}
                text={
                  isForWhitelist
                    ? t('page.selectAddress.selectWatchAddress')
                    : t('page.sendPoly.sendToWatchAddress')
                }
              />
            )}
            {!!allAccounts.filter(acc => acc.brandName === KEYRING_CLASS.GNOSIS)
              .length && (
              <OtherAddressNav
                onPress={() => handleGotoImportedAddress('safe')}
                text={
                  isForWhitelist
                    ? t('page.selectAddress.selectSafeAddress')
                    : t('page.sendPoly.sendToSafeAddress')
                }
              />
            )}
            <View style={styles.footerGap} />
          </View>
        }
      />
    </NormalScreenContainer2024>
  );
};

SelectMyAddressScreen.ForWhitelist = () => {
  return <SelectMyAddressScreen isForWhitelist />;
};

export default SelectMyAddressScreen;

const getStyles = createGetStyles2024(() => ({
  root: {
    position: 'relative',
    paddingHorizontal: 16,
  },
  item: {
    marginBottom: 8,
  },
  listContainer: {
    flex: 1,
    paddingTop: 16,
  },
  footer: {
    marginTop: 12,
  },
  footerGap: {
    height: 150,
  },
}));
