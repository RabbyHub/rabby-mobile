import RcIconCheck from '@/assets/icons/select-chain/icon-checked.svg';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { GasAccountBalance } from './GasAccountBalance';
import { openapi } from '@/core/request';
import { sortBy } from 'lodash';
import { GasAccountInfo } from '@rabby-wallet/rabby-api/dist/types';

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
  const { t } = useTranslation();

  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const filterAccounts = React.useMemo(
    () =>
      [...accounts].filter(
        a => a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
      ),
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
      return list;
    }
    return sortBy(_list, item => {
      const info = gasAccountBalanceDict[item.address.toLowerCase()];
      if (!info) {
        return 2;
      }
      return !info.balance ? (info.no_register ? 1 : 0) : -info.balance;
    });
  }, [_list, gasAccountBalanceDict, isGasAccount]);

  const renderItem = useMemoizedFn(({ item }: { item: Account }) => (
    <TouchableOpacity
      style={styles.accountItem}
      onPress={() => {
        onChange?.(item);
      }}>
      <AddressItem account={item} fetchAccount={false}>
        {({ WalletIcon, WalletName, WalletAddress, WalletBalance }) => (
          <View style={styles.itemInner}>
            <WalletIcon style={styles.walletIcon} />
            <View style={styles.itemContent}>
              <View style={styles.walletNameContainer}>
                <WalletName />
                {isSameAddress(selectedAccount?.address || '', item.address) &&
                selectedAccount?.type === item.type ? (
                  <RcIconCheck height={20} />
                ) : null}
              </View>

              {isGasAccount ? (
                <WalletBalance style={styles.walletBalance} />
              ) : (
                <WalletAddress style={styles.walletAddress} />
              )}
            </View>
            <View style={{ marginLeft: 'auto' }}>
              {isGasAccount ? (
                <GasAccountBalance
                  account={gasAccountBalanceDict?.[item.address.toLowerCase()]}
                />
              ) : (
                <WalletBalance />
              )}
            </View>
          </View>
        )}
      </AddressItem>
    </TouchableOpacity>
  ));

  return (
    <View style={[styles.container, style]}>
      <View style={styles.containerHorizontal}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {listHeader}
      </View>
      <BottomSheetFlatList
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={styles.containerHorizontal}
        data={list}
        keyExtractor={(item, index) => item.type + item.address + index}
        renderItem={renderItem}
        // extraData={tmpSelectAccount}
      />
      {listFooter}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
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
  description: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginBottom: 10,
  },
  amountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: 52,
  },
  amountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 8,
    height: 60,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: colors['blue-light1'],
    borderColor: colors['blue-default'],
  },
  amountText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  input: {
    flex: 1,
    height: 60,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 10,
    color: colors2024['neutral-body'],
  },
  tokenLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors['neutral-card2'],
    borderRadius: 30,
    width: '100%',
    height: 62,
    paddingHorizontal: 20,
  },
  flatList: {
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  tokenListItem: {
    paddingVertical: 14,
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 6,
  },
  tokenContent: { flexDirection: 'row', alignItems: 'center' },
  tokenSymbol: {
    marginLeft: 12,
    color: colors['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  tokenPlaceholder: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  confirmButton: {
    width: '100%',
    height: 52,
    marginBottom: 35,
  },
  popup: {
    margin: 0,
    height: '100%',
    paddingVertical: 10,
  },
  btnContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'flex-end',
    flex: 1,
  },

  box: { flexDirection: 'row', alignItems: 'center' },
  text: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  errorTips: {
    textAlign: 'left',
    width: '100%',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 20,
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
  },

  insufficientWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientDivider: {
    position: 'absolute',
    top: 18,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: colors2024['red-light-2'],
  },

  insufficientTip: {
    color: colors2024['red-default'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    backgroundColor: colors['neutral-bg-1'],
    paddingHorizontal: 8,
  },

  tokenInsufficientWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },

  tokenInsufficientDivider: {
    position: 'absolute',
    top: 9,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },

  tokenInsufficientTip: {
    color: colors2024['neutral-info'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    backgroundColor: colors['neutral-bg-1'],
    paddingHorizontal: 8,
  },

  searchInputContainer: {
    borderRadius: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 12,
    borderColor: 'transparent',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchIconWrapperStyle: {
    paddingLeft: 0,
  },
  inputStyle: {
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    fontSize: 17,
    color: colors2024['neutral-title-1'],
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

  pinnedWrapper: {
    flexShrink: 0,
    marginLeft: 4,
    borderRadius: 6,
    width: 33,
    height: 20,
    flexWrap: 'nowrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['brand-light-1'],
  },
  pinText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },
  walletName: {
    color: colors2024['neutral-title-1'],

    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },

  walletIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
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

  walletAddress: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },

  walletBalance: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
}));
