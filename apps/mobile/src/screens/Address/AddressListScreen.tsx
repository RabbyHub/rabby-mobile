import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemEntry } from './components/AddressItem';
import { RootNames } from '@/constant/layout';
import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createGetStyles2024 } from '@/utils/styles';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { AddressListScreenContainer } from './components/AddressListScreenContainer';
import { useSortAddressList } from './useSortAddressList';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

const OtherAddressNav = ({ onPress, text }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity onPress={onPress} style={styles.sectionFooter}>
      <Text style={styles.headlineText}>{text}</Text>
      <ArrowRightSVG
        style={styles.arrow}
        width={14}
        height={14}
        color={colors2024['neutral-secondary']}
      />
    </TouchableOpacity>
  );
};

export function AddressListScreen(): JSX.Element {
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });
  const { styles } = useTheme2024({ getStyle });
  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const hasWatchAddress = React.useMemo(() => {
    return accounts.some(account => account.type === KEYRING_CLASS.WATCH);
  }, [accounts]);
  const hasSafeAddress = React.useMemo(() => {
    return accounts.some(account => account.type === KEYRING_CLASS.GNOSIS);
  }, [accounts]);

  const filterAccounts = React.useMemo(
    () =>
      [...accounts].filter(
        a => a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
      ),
    [accounts],
  );

  const list = useSortAddressList(filterAccounts);
  const onGotoWatchAddress = React.useCallback(() => {
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.WatchAddressList,
    });
  }, [navigation]);

  const onGotoSafeAddress = React.useCallback(() => {
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.SafeAddressList,
    });
  }, [navigation]);

  useFocusEffect(
    // keep same with multi address home
    React.useCallback(() => {
      fetchAccounts();
    }, [fetchAccounts]),
  );

  return (
    <AddressListScreenContainer>
      <FlatList
        data={list}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={({ item, index }) => (
          <View
            key={`${item.address}-${item.type}-${item.brandName}-${index}`}
            style={index < list.length - 1 ? styles.itemGap : undefined}>
            <AddressItemEntry account={item} />
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.headline}>
            <Text style={styles.headlineText}>My Address ({list?.length})</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {hasSafeAddress && (
              <OtherAddressNav
                onPress={onGotoSafeAddress}
                text={'Imported Safe Address'}
              />
            )}
            {hasWatchAddress && (
              <OtherAddressNav
                onPress={onGotoWatchAddress}
                text={'Imported Watch-only address'}
              />
            )}
            <View style={styles.footerGap} />
          </View>
        }
      />
    </AddressListScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headline: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  headlineText: {
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  itemGap: {
    marginBottom: 12,
  },
  footer: {
    marginTop: 12,
  },
  sectionFooter: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  arrow: {
    marginTop: 2,
  },
  footerGap: {
    height: 150,
  },
}));
