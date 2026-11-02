import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import RcIconPencilCC from '@/assets2024/memecoin/pencil-cc.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { DashedDivider } from '../components/DashedDivider';
import { formatAllocationPct, getMemeAllocations } from '../ui/helpers';

export const BuyAmountCard = ({
  amountText,
  amountUsd,
  onChangeAmount,
  memes,
}: {
  amountText: string;
  /** null when amountText is invalid */
  amountUsd: number | null;
  onChangeAmount: (text: string) => void;
  memes: Array<{
    id: string;
    chain: string;
    symbol: string;
    marketCap: number;
    logoUrl: string;
  }>;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [editing, setEditing] = useState(false);
  const allocations = useMemo(
    () => getMemeAllocations(amountUsd ?? 0, memes),
    [amountUsd, memes],
  );
  const amountStyle = [
    styles.amount,
    amountUsd === null && styles.amountInvalid,
  ];

  // Android hides the keyboard on back without blurring the input
  useEffect(() => {
    if (!editing) {
      return;
    }
    const sub = Keyboard.addListener('keyboardDidHide', () =>
      setEditing(false),
    );
    return () => sub.remove();
  }, [editing]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('page.memeCoin.buy.amount')}</Text>
      <View style={styles.amountRow}>
        {editing ? (
          <View style={styles.amountTouch}>
            <Text style={amountStyle}>$</Text>
            <TextInput
              autoFocus
              selectTextOnFocus
              value={amountText}
              onChangeText={onChangeAmount}
              onBlur={() => setEditing(false)}
              keyboardType="decimal-pad"
              style={[amountStyle, styles.amountInput]}
            />
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.amountTouch}
            onPress={() => setEditing(true)}>
            <Text style={[amountStyle, styles.amountText]} numberOfLines={1}>
              {amountUsd === null
                ? `$${amountText}`
                : formatUsdValue(amountUsd)}
            </Text>
            <RcIconPencilCC
              width={24}
              height={24}
              color={colors2024['neutral-secondary']}
            />
          </TouchableOpacity>
        )}
        <View style={styles.usdTag}>
          <Text style={styles.usdText}>USD</Text>
        </View>
      </View>
      <DashedDivider style={styles.divider} />
      <View style={styles.allocations}>
        {allocations.map(({ meme, ratio, amountUsd: memeUsd }) => (
          <View key={`${meme.chain}:${meme.id}`} style={styles.allocation}>
            <AssetAvatar
              logo={meme.logoUrl}
              chain={meme.chain}
              size={28}
              chainSize={12}
              logoStyle={styles.memeLogo}
            />
            <View style={styles.allocationText}>
              <Text style={styles.allocationUsd} numberOfLines={1}>
                {formatUsdValue(memeUsd)}
              </Text>
              <View style={styles.allocationDivider} />
              <Text style={styles.allocationPct} numberOfLines={1}>
                {formatAllocationPct(ratio)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-card-1'],
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  amountRow: {
    marginTop: 8,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountTouch: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  amountText: {
    flexShrink: 1,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    padding: 0,
  },
  amountInvalid: {
    color: colors2024['red-default'],
  },
  usdTag: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
  },
  usdText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
  },
  divider: {
    marginTop: 16,
    marginBottom: 14,
  },
  allocations: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 28,
    rowGap: 8,
  },
  allocation: {
    // two per row: the 28 gap keeps a third item from fitting at 40%
    flexBasis: '40%',
    flexGrow: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  allocationText: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  allocationUsd: {
    flexShrink: 0,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-body'],
  },
  allocationDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors2024['neutral-line'],
  },
  allocationPct: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  memeLogo: {
    borderRadius: 8,
  },
}));
