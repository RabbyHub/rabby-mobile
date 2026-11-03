import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import RcIconPencilCC from '@/assets2024/memecoin/pencil-cc.svg';
import RcIconSwitchCC from '@/assets2024/memecoin/switch-cc.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { DashedDivider } from '../components/DashedDivider';
import type { AllocationMode } from '../engine/types';
import { formatAllocationPct, getMemeAllocations } from '../ui/helpers';

const ALLOCATION_LABEL_KEYS: Record<AllocationMode, string> = {
  marketCap: 'page.memeCoin.buy.byMarketCap',
  equal: 'page.memeCoin.buy.equalSplit',
};

export const BuyAmountCard = ({
  amountText,
  amountUsd,
  onChangeAmount,
  memes,
  allocationMode,
  onToggleAllocationMode,
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
  allocationMode: AllocationMode;
  onToggleAllocationMode: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [editing, setEditing] = useState(false);
  const allocations = useMemo(
    () => getMemeAllocations(amountUsd ?? 0, memes, allocationMode),
    [amountUsd, memes, allocationMode],
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
      <View style={styles.allocationHeader}>
        <Text style={styles.allocationLabel}>
          {t('page.memeCoin.buy.allocation')}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          hitSlop={8}
          onPress={onToggleAllocationMode}
          style={styles.allocationToggle}>
          <Text style={styles.allocationMode}>
            {t(ALLOCATION_LABEL_KEYS[allocationMode])}
          </Text>
          <RcIconSwitchCC
            width={14}
            height={14}
            color={colors2024['brand-default']}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.allocations}>
        {allocations.map(({ meme, ratio, amountUsd: memeUsd }) => (
          <View key={`${meme.chain}:${meme.id}`} style={styles.allocation}>
            <View style={styles.allocationMeme}>
              <AssetAvatar
                logo={meme.logoUrl}
                chain={meme.chain}
                size={28}
                chainSize={12}
                logoStyle={styles.memeLogo}
              />
              <Text style={styles.allocationSymbol} numberOfLines={1}>
                {meme.symbol}
              </Text>
            </View>
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
  amountRow: {
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
  // No lineHeight: iOS offsets it for Text but not for TextInput, so the amount
  // would drop a few points when it turns into the input. Without font padding
  // the natural line still fits the row on Android.
  amount: {
    includeFontPadding: false,
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
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
  },
  allocationHeader: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allocationLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  allocationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  allocationMode: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  allocations: {
    marginTop: 14,
    gap: 8,
  },
  allocation: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  allocationMeme: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allocationSymbol: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-body'],
  },
  allocationText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allocationUsd: {
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
