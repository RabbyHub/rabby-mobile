import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { AddressEntry } from './RenderRow/AddressEntry';
import { Card } from '@/components2024/Card';
import { useTheme2024 } from '@/hooks/theme';
import PlusSVG from '@/assets2024/icons/common/plus-cc.svg';
import { useTranslation } from 'react-i18next';
import { useAccountInfo } from './hooks';
import { OtherAddressNav } from '../OtherAddressNav';
import { createGetStyles2024 } from '@/utils/styles';
import { CurrentAddressProps } from '../AddressListScreenContainer';
import { StackActions, useNavigation } from '@react-navigation/native';
import { AppRootName, RootNames } from '@/constant/layout';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { getChangeData } from '@/hooks/useCurve';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useBalanceUpdate } from './hooks/balance';
import { Tabs } from 'react-native-collapsible-tab-view';

export const AddressList = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const navigation = useNavigation<CurrentAddressProps['navigation']>();
  const {
    top10Addresses,
    list: _rawList,
    hasWatchAddress,
    hasSafeAddress,
  } = useAccountInfo();

  const { triggerUpdate, getTotalBalance, balanceAccounts } =
    useAccountsBalance({
      cacheTime: 10 * 60 * 1000,
      accountsNoUnique: true, // balanceAccounts has filter same address accounts
    });

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);
  const { multiTimeStamp } = useMultiCurve(top10Addresses, false, top10Balance);

  useBalanceUpdate(triggerUpdate);

  const list = useMemo(() => {
    return _rawList.map(item => {
      const account = balanceAccounts.find(acc =>
        isSameAddress(acc.address, item.address),
      );
      return {
        ...item,
        balance: account?.balance || item.balance || 0,
      };
    });
  }, [balanceAccounts, _rawList]);

  const addressListData = useMemo(() => {
    return [
      ...list.map(item => {
        const hasChangeData = multiTimeStamp[
          item.address.toLocaleLowerCase()
        ]?.data?.some(i => i.usd_value !== 0);
        const chartData = getChangeData(
          multiTimeStamp[item.address.toLocaleLowerCase()]?.data || [],
          item.balance,
          new Date().getTime(),
        );
        return {
          ...item,
          balance:
            item.balance > 10
              ? Math.floor(item.balance)
              : Number(item.balance.toFixed(2)),
          changPercent: hasChangeData ? chartData?.changePercent : undefined,
          isLoss: hasChangeData ? chartData?.isLoss : undefined,
        };
      }),
    ];
  }, [list, multiTimeStamp]);

  const renderItem = useCallback(
    ({ item }) => {
      return (
        <View style={styles.itemGap}>
          <AddressEntry data={item} />
        </View>
      );
    },
    [styles.itemGap],
  );

  const onGotoWatchAddress = useCallback(() => {
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.WatchAddressList,
    });
  }, [navigation]);

  const onGotoSafeAddress = useCallback(() => {
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.SafeAddressList,
    });
  }, [navigation]);

  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

  const gotoAddAddress = useCallback(() => {
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

  const renderFooter = useCallback(
    () => (
      <View>
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
            text={t('page.addressDetail.addressListScreen.importSafeAddress')}
          />
        )}
        {hasWatchAddress && (
          <OtherAddressNav
            onPress={onGotoWatchAddress}
            text={t('page.addressDetail.addressListScreen.importWatchAddress')}
          />
        )}
        <View style={styles.footerGap} />
      </View>
    ),
    [
      colors2024,
      gotoAddAddress,
      hasSafeAddress,
      hasWatchAddress,
      onGotoSafeAddress,
      onGotoWatchAddress,
      styles.footerCard,
      styles.footerCardText,
      styles.footerGap,
      styles.footerMain,
      t,
    ],
  );

  return (
    <Tabs.FlatList
      data={addressListData}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      ListFooterComponent={renderFooter}
    />
  );
};

const getStyles = createGetStyles2024(ctx => ({
  footerGap: {
    height: 70,
  },
  footerCard: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    marginTop: 16,
    marginBottom: 22,
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCardText: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  itemGap: {
    marginTop: 8,
  },
  list: {
    paddingHorizontal: 16,
  },
}));
