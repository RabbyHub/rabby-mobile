import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { formatPercentageKMB } from '@/screens/Market/utils/formatPercentageKMB';
import { ellipsisAddress } from '@/utils/address';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { SelectedBadge } from './SelectedBadge';

export const MEME_ROW_HEIGHT = 70;

type Props = {
  itemKey: string;
  logoUrl: string;
  chain: string;
  symbol: string;
  address: string;
  valueText: string;
  change24h: number | null;
  /** holding rows only: USD, shown instead of change24h; null renders "--" */
  pnl?: number | null;
  selected: boolean;
  onPress: (itemKey: string) => void;
};

export const MemeTokenRow = React.memo(function MemeTokenRow({
  itemKey,
  logoUrl,
  chain,
  symbol,
  address,
  valueText,
  change24h,
  pnl,
  selected,
  onPress,
}: Props) {
  const { styles } = useTheme2024({ getStyle });
  const handlePress = useCallback(() => onPress(itemKey), [onPress, itemKey]);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[styles.row, selected && styles.rowSelected]}>
      <AssetAvatar logo={logoUrl} chain={chain} size={44} chainSize={18} />
      <View style={styles.middle}>
        <Text style={styles.symbol} numberOfLines={1}>
          {symbol}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          {ellipsisAddress(address, 4)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.value} numberOfLines={1}>
          {valueText}
        </Text>
        {pnl !== undefined ? (
          <Text
            style={
              pnl === null
                ? styles.changeNone
                : pnl < 0
                ? styles.changeDown
                : styles.changeUp
            }>
            {pnl === null
              ? '--'
              : `${pnl < 0 ? '' : '+'}${formatUsdValue(pnl)}`}
          </Text>
        ) : change24h === null ? (
          <Text style={styles.changeNone}>--</Text>
        ) : (
          <Text style={change24h < 0 ? styles.changeDown : styles.changeUp}>
            {formatPercentageKMB(change24h)}
          </Text>
        )}
      </View>
      {selected ? <SelectedBadge /> : null}
    </TouchableOpacity>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    height: MEME_ROW_HEIGHT,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors2024['neutral-card-1'],
  },
  rowSelected: {
    borderColor: colors2024['brand-disable'],
  },
  middle: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginTop: 1,
    gap: 6,
  },
  symbol: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-body'],
  },
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  right: {
    marginLeft: 8,
    alignItems: 'flex-end',
    gap: 2,
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  changeUp: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['green-default'],
  },
  changeDown: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['red-default'],
  },
  changeNone: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
}));
