import { Text } from '@/components';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import BigNumber from 'bignumber.js';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

interface Props {
  account: KeyringAccountWithAlias;
  token: AbstractPortfolioToken;
}

export const TokenBalanceArea: React.FC<Props> = ({ account, token }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const name = useMemo(
    () => account?.aliasName || account?.brandName,
    [account],
  );

  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.accountBox}>
          <View className="relative">
            <WalletIcon
              type={account?.type as KEYRING_TYPE}
              width={styles.walletIcon.width}
              height={styles.walletIcon.height}
              style={styles.walletIcon}
            />
          </View>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
            {name}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <View>
          <Text style={styles.balanceTitle}>{t('global.Balance')}</Text>
        </View>
        <View style={styles.tokenBox}>
          <Text style={styles.tokenUsd}>
            {formatUsdValue(
              new BigNumber(token.amount).times(token.price).toFixed(),
            )}
          </Text>
          <Text style={styles.tokenAmount}>
            {formatTokenAmount(token.amount)}
            {token.symbol}
          </Text>
        </View>
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 30,
  },
  accountBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    flexShrink: 1,
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },

  walletIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },

  body: {},
  balanceTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },

  tokenBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 16,
  },
  tokenUsd: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
  },
  tokenAmount: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
}));
