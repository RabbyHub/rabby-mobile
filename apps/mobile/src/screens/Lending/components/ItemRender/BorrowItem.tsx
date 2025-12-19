import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import TokenIcon from '../TokenIcon';
import { DisplayPoolReserveInfo } from '../../type';
import { formatApy, formatListNetWorth } from '../../utils/format';

interface BorrowItemProps extends RNViewProps {
  reserve: DisplayPoolReserveInfo;
  onPressSwap?: (reserve: DisplayPoolReserveInfo) => void;
  onPressBorrow?: (reserve: DisplayPoolReserveInfo) => void;
  onPressRepay?: (reserve: DisplayPoolReserveInfo) => void;
}

const BorrowItem: React.FC<BorrowItemProps> = ({
  reserve,
  style,
  onPressSwap,
  onPressBorrow,
  onPressRepay,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const { isBorrowed, apyText, usdText, tokenAmountText } = useMemo(() => {
    const isBorrowedFlag =
      !!reserve.totalBorrowsUSD && reserve.totalBorrowsUSD !== '0';

    const apy = formatApy(Number(reserve.reserve.variableBorrowAPY || '0'));
    const usd = formatListNetWorth(Number(reserve.totalBorrowsUSD || '0'));

    const tokenAmountNum = Number(reserve.variableBorrows || '0');
    let tokenAmount = '';
    if (tokenAmountNum) {
      if (tokenAmountNum >= 1) {
        tokenAmount = tokenAmountNum.toFixed(4);
      } else {
        tokenAmount = tokenAmountNum.toPrecision(4);
      }
    } else {
      tokenAmount = '0';
    }

    return {
      isBorrowed: isBorrowedFlag,
      apyText: apy,
      usdText: usd,
      tokenAmountText: `${tokenAmount} ${reserve.reserve.symbol}`,
    };
  }, [reserve]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-2'],
        },
        style,
      ]}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.tokenInfo}>
            <TokenIcon
              size={46}
              chainSize={0}
              tokenSymbol={reserve.reserve.symbol}
              chain={reserve.chain}
            />
            <View style={styles.symbolArea}>
              <Text
                style={styles.symbol}
                numberOfLines={1}
                ellipsizeMode="tail">
                {reserve.reserve.symbol}
              </Text>
              <View style={styles.apyTag}>
                <Text style={styles.apyTagText}>{`Apy ${apyText}`}</Text>
              </View>
            </View>
          </View>
          <View style={styles.amountArea}>
            <Text style={styles.amountUsd}>{usdText}</Text>
            <Text style={styles.amountToken} numberOfLines={1}>
              {tokenAmountText}
            </Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.buttonSecondary}
            activeOpacity={0.8}
            onPress={() => onPressSwap?.(reserve)}>
            <Text style={styles.buttonSecondaryText}>Swap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonSecondary}
            activeOpacity={0.8}
            onPress={() => onPressBorrow?.(reserve)}>
            <Text style={styles.buttonSecondaryText}>Borrow</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonPrimary}
            activeOpacity={0.8}
            onPress={() => onPressRepay?.(reserve)}>
            <Text style={styles.buttonPrimaryText}>Repay</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isBorrowed ? (
        <View style={styles.borrowedBadge}>
          <Text style={styles.borrowedBadgeText}>Borrowed</Text>
        </View>
      ) : null}
    </View>
  );
};

export default BorrowItem;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    borderRadius: 16,
    paddingTop: 40,
    paddingBottom: 12,
    paddingHorizontal: 0,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 2,
    position: 'relative',
  },
  content: {
    paddingHorizontal: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  symbolArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  symbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  apyTag: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors2024['red-light-1'],
  },
  apyTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
  amountArea: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountUsd: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  amountToken: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  buttonRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonSecondary: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
  },
  buttonSecondaryText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  buttonPrimary: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['brand-light-1'],
  },
  buttonPrimaryText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
  },
  borrowedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors2024['red-default'],
  },
  borrowedBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
  },
}));
