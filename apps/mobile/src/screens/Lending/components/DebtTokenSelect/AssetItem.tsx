import React from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { TouchableOpacity, View } from 'react-native';
import { SwappableToken } from '../../types/swap';
import WalletFillCC from '@/assets2024/icons/lending/wallet-fill-cc.svg';
import TokenIcon from '../TokenIcon';
import { formatUsdValueKMB } from '@/screens/TokenDetail/util';
import { formatApy, formatListNetWorth } from '../../utils/format';
import { Text } from '@/components/Typography';

const AssetItem = ({
  token,
  onPress,
}: {
  token: SwappableToken;
  onPress: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const isZeroBorrowed = token.totalBorrowsUSD === '0';
  return (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <View style={styles.left}>
        <TokenIcon size={46} chainSize={0} tokenSymbol={token.symbol} />
        <View style={styles.symbolContainer}>
          <Text style={styles.symbol} numberOfLines={1} ellipsizeMode="tail">
            {token.symbol}
          </Text>
          <View style={styles.yourBalanceContainer}>
            <WalletFillCC
              width={16}
              height={16}
              style={styles.walletIcon}
              color={colors2024['secondary-foot']}
            />
            <Text style={styles.yourBalance}>
              {formatUsdValueKMB(token.walletBalanceUSD || '0')}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.apy}>
        {formatApy(Number(token.variableBorrowAPY || '0'))}
      </Text>
      <View style={styles.right}>
        {isZeroBorrowed ? (
          <Text style={[styles.yourSupplied, styles.zeroBorrowed]}>$0</Text>
        ) : (
          <Text style={styles.yourSupplied}>
            {formatListNetWorth(Number(token.totalBorrowsUSD || '0'))}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default AssetItem;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'space-between',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    marginTop: 8,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  apy: {
    flex: 0,
    width: 60,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  right: {
    flex: 0,
    marginLeft: 10,
    width: 80,
  },
  symbolContainer: {
    gap: 2,
  },
  symbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  yourSupplied: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  zeroBorrowed: {
    color: colors2024['neutral-info'],
  },
  yourBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  walletIcon: {
    width: 16,
    height: 16,
    color: colors2024['neutral-secondary'],
    marginTop: -2,
  },
  yourBalance: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
}));
