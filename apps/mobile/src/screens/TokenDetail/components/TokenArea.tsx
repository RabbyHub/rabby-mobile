import { Text } from '@/components';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import type { CombineTokensItem } from '@/screens/Home/hooks/store';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ellipsisAddress } from '@/utils/address';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import BigNumber from 'bignumber.js';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, TouchableOpacity, View } from 'react-native';

interface Props {
  token: AbstractPortfolioToken;
  amountList: CombineTokensItem['fromAddress'];
  handleSwap: (type: 'Buy' | 'Sell', address: string) => void;
}

type amountItem = CombineTokensItem['fromAddress'][number];

export const TokenArea: React.FC<Props> = ({
  token,
  amountList,
  handleSwap,
}) => {
  const { accounts } = useMyAccounts();
  const sortedAccounts = useSortAddressList(accounts);
  const { styles } = useTheme2024({ getStyle: getStyles });

  const getAccount = useCallback(
    (address: string) => {
      const item = sortedAccounts.find(
        a =>
          a.type !== KEYRING_TYPE.WatchAddressKeyring &&
          isSameAddress(a.address, address),
      );
      return item;
    },
    [sortedAccounts],
  );

  const { t } = useTranslation();

  const renderItem = useCallback(
    ({ item }: { item: amountItem }) => {
      return (
        <View style={styles.itemCard}>
          <View style={styles.tokenBox}>
            <Text style={styles.tokenAmount} numberOfLines={1}>
              {formatTokenAmount(item.amount)}
              {token.symbol}
            </Text>
            <View style={styles.accountBox}>
              <View className="relative">
                <WalletIcon
                  type={getAccount(item.address)?.type as KEYRING_TYPE}
                  width={styles.walletIcon.width}
                  height={styles.walletIcon.height}
                  style={styles.walletIcon}
                />
              </View>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.titleText}>
                {getAccount(item.address)?.aliasName ||
                  getAccount(item.address)?.brandName}
              </Text>
            </View>
          </View>
          <View style={styles.actionBox}>
            <TouchableOpacity onPress={() => handleSwap('Buy', item.address)}>
              <Text style={styles.actionText}>
                {t('page.tokenDetail.action.Buy')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSwap('Sell', item.address)}>
              <Text style={styles.actionText}>
                {t('page.tokenDetail.action.Sell')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      handleSwap,
      styles.accountBox,
      styles.actionBox,
      styles.actionText,
      styles.itemCard,
      styles.titleText,
      styles.tokenAmount,
      styles.tokenBox,
      styles.walletIcon,
      t,
      token.symbol,
      getAccount,
    ],
  );

  const ListHeaderComponent = useCallback(() => {
    return (
      <View style={styles.header}>
        <Text style={styles.balanceTitle}>{t('global.Balance')}</Text>
      </View>
    );
  }, [styles.header, styles.balanceTitle, t]);

  const sortedList = useMemo(
    () =>
      amountList?.sort((a, b) =>
        new BigNumber(b.amount).comparedTo(new BigNumber(a.amount)),
      ),
    [amountList],
  );

  return (
    <View style={styles.container}>
      {ListHeaderComponent()}
      {sortedList.length && sortedList.map(item => renderItem({ item }))}
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    marginTop: 30,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 4,
  },
  accountBox: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
  },
  titleText: {
    flexShrink: 1,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },

  walletIcon: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },

  body: {},
  balanceTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },

  itemCard: {
    marginTop: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    borderColor: ctx.colors2024['neutral-line'],
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  tokenBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'row',
    width: 100,
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionText: {
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  tokenUsd: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
  },
  tokenAmount: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
}));
