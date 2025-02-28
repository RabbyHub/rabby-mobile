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
import { useMyAccounts } from '@/hooks/account';
import { useWhitelist } from '@/hooks/whitelist';

const triggerLight = () => {
  trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
};

const SelectMyAddressScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { accounts } = useMyAccounts();
  const { whitelist } = useWhitelist();
  const { navigation } = useSafeSetNavigationOptions();
  const handleGotoImportedAddress = (type: 'watch' | 'safe') => {
    triggerLight();
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.SelectTypeAddress,
        params: { type },
      }),
    );
  };

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
      <FlatList
        data={accounts.sort((a, b) => (b.balance || 0) - (a.balance || 0))}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <WhiteListItem
              account={item}
              inWhiteList={whitelist.includes(item.address)}
              hiddenArrow
            />
          </View>
        )}
        ListEmptyComponent={EmptyWhiteListHolder}
        ListFooterComponent={
          <View style={styles.footer}>
            <OtherAddressNav
              onPress={() => handleGotoImportedAddress('watch')}
              text={'Select to Watch-Only Addresses'}
            />
            <OtherAddressNav
              onPress={() => handleGotoImportedAddress('safe')}
              text={'Select to Safe Addresses'}
            />
            <View style={styles.footerGap} />
          </View>
        }
      />
    </NormalScreenContainer2024>
  );
};

export default SelectMyAddressScreen;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    position: 'relative',
    paddingHorizontal: 16,
  },
  input: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 10,
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
  },
  item: {
    marginBottom: 8,
  },
  placeHolder: {
    color: colors2024['neutral-secondary'],
    fontSize: 18,
    fontFamily: 'SF Pro Rounded',
  },
  listContainer: {
    flex: 1,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 18,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  footer: {
    marginTop: 12,
  },
  footerGap: {
    height: 150,
  },
}));
