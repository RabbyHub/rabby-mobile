import React from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, TouchableOpacity, View } from 'react-native';
import { SwappableToken } from '../../types/swap';
import WalletFillCC from '@/assets2024/icons/lending/wallet-fill-cc.svg';
import TokenIcon from '../TokenIcon';
import { formatUsdValueKMB } from '@/screens/TokenDetail/util';
import { formatApy, formatListNetWorth } from '../../utils/format';

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
  container: {
    position: 'relative',
    flex: 1,
    width: '100%',
  },
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
  ava: {
    width: 46,
    height: 46,
    borderRadius: 46,
    backgroundColor: colors2024['neutral-bg-2'],
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
  listHeader: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 2,
  },
  headerToken: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    flex: 1,
  },
  headerApy: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    width: 60,
    flex: 0,
  },
  headerMyBorrows: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    flex: 0,
    marginLeft: 10,
    width: 80,
  },
  headerContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  loading: {
    width: 124,
    marginTop: 16,
    backgroundColor: colors2024['neutral-bg-5'],
    marginBottom: 2,
    marginLeft: 8,
  },
  availableCard: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    marginTop: 8,
    gap: 2,
  },
  availableCardIsolated: {
    backgroundColor: colors2024['orange-light-1'],
  },
  availableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availableCardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  orangeText: {
    color: colors2024['orange-default'],
  },
  usdValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  availableCardValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
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
