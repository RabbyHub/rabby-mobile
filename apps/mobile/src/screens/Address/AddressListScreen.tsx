import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemEntry } from './components/AddressItem';
import { AppRootName, RootNames } from '@/constant/layout';
import {
  useFocusEffect,
  useNavigation,
  StackActions,
} from '@react-navigation/core';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createGetStyles2024 } from '@/utils/styles';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { AddressListScreenContainer } from './components/AddressListScreenContainer';
import { useSortAddressList } from './useSortAddressList';
import { AddressEmptyContainer } from './components/AddressEmptyContainer';
import { Card } from '@/components2024/Card';
import PlusSVG from '@/assets2024/icons/common/plus-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { useTranslation } from 'react-i18next';

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
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const navigation = useNavigation<CurrentAddressProps['navigation']>();
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

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

  const gotoAddAddress = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      shouldRedirectToSetPasswordBefore2024,
      navigateTo: (screen: AppRootName, params?: object) => {
        navigation.dispatch(
          StackActions.push(RootNames.StackAddress, {
            screen,
            params,
          }),
        );
      },
    });
  }, [shouldRedirectToSetPasswordBefore2024, navigation]);

  const { t } = useTranslation();

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
        ListEmptyComponent={AddressEmptyContainer}
        ListFooterComponent={
          <View style={styles.footer}>
            <Card style={styles.footerCard} onPress={gotoAddAddress}>
              <View style={styles.footerMain}>
                <PlusSVG
                  width={20}
                  height={20}
                  color={colors2024['neutral-secondary']}
                />
                <Text style={styles.footerCardText}>
                  {t('page.addressDetail.addressListScreen.addAddress')}
                </Text>
              </View>
            </Card>
            {hasSafeAddress && (
              <OtherAddressNav
                onPress={onGotoSafeAddress}
                text={t(
                  'page.addressDetail.addressListScreen.importSafeAddress',
                )}
              />
            )}
            {hasWatchAddress && (
              <OtherAddressNav
                onPress={onGotoWatchAddress}
                text={t(
                  'page.addressDetail.addressListScreen.importWatchAddress',
                )}
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
    paddingTop: 16,
  },

  itemGap: {
    marginBottom: 12,
  },
  footer: {
    marginTop: 12,
  },
  footerCard: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginBottom: 22,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCardText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  sectionFooter: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    marginTop: 2,
  },
  footerGap: {
    height: 150,
  },
}));
