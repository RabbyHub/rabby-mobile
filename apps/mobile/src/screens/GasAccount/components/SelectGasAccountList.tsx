import RcIconCheck from '@/assets/icons/select-chain/icon-checked.svg';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { openapi } from '@/core/request';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { filterMyAccounts } from '@/utils/account';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { GasAccountInfo } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn, useRequest } from 'ahooks';
import { sortBy } from 'lodash';
import React, { ReactNode, useMemo } from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { GasAccountBalance } from './GasAccountBalance';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { trigger } from 'react-native-haptic-feedback';

export const SelectGasAccountList = ({
  onChange,
  value: selectedAccount,
  title,
  listFooter,
  listHeader,
  style,
  isGasAccount,
}: {
  onChange?: (account: Account) => void;
  value?: Account;
  title?: string;
  listFooter?: ReactNode;
  listHeader?: ReactNode;
  style?: StyleProp<ViewStyle>;
  isGasAccount?: boolean;
}) => {
  const { styles } = useTheme2024({
    getStyle: getStyles,
  });

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const filterAccounts = useMemo(
    () => [...filterMyAccounts(accounts)],
    [accounts],
  );

  const _list = useSortAddressList(filterAccounts);

  const { data: gasAccountBalanceDict } = useRequest(
    async () => {
      if (!isGasAccount) {
        return;
      }
      const res = await Promise.all(
        _list.map(item => {
          return openapi
            .getGasAccountInfoV2({
              id: item.address,
            })
            .catch(() => null);
        }),
      );
      const dict: Record<string, GasAccountInfo> = {};
      res.forEach(item => {
        if (item?.account) {
          dict[item.account.id.toLowerCase()] = item.account;
        }
      });
      return dict;
    },
    {
      cacheKey: 'batch-fetch-gas-account-info',
    },
  );

  const list = useMemo(() => {
    if (!isGasAccount || !gasAccountBalanceDict) {
      return _list;
    }
    return sortBy(_list, item => {
      const info = gasAccountBalanceDict[item.address.toLowerCase()];
      if (!info) {
        return 2;
      }
      return !info.balance ? (info.no_register ? 1 : 0) : -info.balance;
    });
  }, [_list, gasAccountBalanceDict, isGasAccount]);

  const renderItem = useMemoizedFn(({ item }: { item: Account }) => {
    const isSelected =
      isSameAddress(selectedAccount?.address || '', item.address) &&
      selectedAccount?.type === item.type;
    return (
      <AddressItemShadowView
        style={[styles.accountItem, isSelected && styles.accountItemSelected]}
        key={`${item.type}-${item.address}`}>
        <TouchableOpacity
          onPress={() => {
            onChange?.(item);
          }}>
          <AddressItem account={item} fetchAccount={false}>
            {({ WalletIcon, WalletName, WalletAddress, WalletBalance }) => (
              <View style={styles.itemInner}>
                <WalletIcon width={46} height={46} borderRadius={12} />
                <View style={styles.itemContent}>
                  <View style={styles.walletNameContainer}>
                    <WalletName style={styles.walletName} />
                    {isSelected ? <RcIconCheck height={20} /> : null}
                  </View>

                  <WalletBalance style={styles.walletBalance} />
                </View>
                <View style={{ marginLeft: 'auto' }}>
                  {isGasAccount ? (
                    <GasAccountBalance
                      account={
                        gasAccountBalanceDict?.[item.address.toLowerCase()]
                      }
                    />
                  ) : null}
                </View>
              </View>
            )}
          </AddressItem>
        </TouchableOpacity>
      </AddressItemShadowView>
    );
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.containerHorizontal}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {listHeader}
        {list.map(item => {
          return renderItem({ item });
        })}
      </View>
      {/* <BottomSheetFlatList
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={styles.containerHorizontal}
        data={list}
        keyExtractor={(item, index) => item.type + item.address + index}
        renderItem={renderItem}
        // extraData={tmpSelectAccount}
      /> */}
      {listFooter}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    width: '100%',
    flex: 1,
  },
  containerHorizontal: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    marginBottom: 18,
    textAlign: 'center',
  },

  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    marginBottom: 12,
  },

  accountItemSelected: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-light-2'],
  },

  itemInner: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },

  itemContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  walletNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  walletName: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },

  walletAddress: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },

  walletBalance: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
}));
