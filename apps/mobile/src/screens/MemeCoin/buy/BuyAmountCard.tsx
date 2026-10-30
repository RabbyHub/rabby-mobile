import React, { useEffect, useState } from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import RcIconPencilCC from '@/assets2024/memecoin/pencil-cc.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { DashedDivider } from '../components/DashedDivider';

const MAX_AVATARS = 6;

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
  memes: Array<{ id: string; chain: string; logoUrl: string }>;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [editing, setEditing] = useState(false);
  const overflow = memes.length > MAX_AVATARS;
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
      <View style={styles.memeRow}>
        <View style={styles.avatars}>
          {memes.slice(0, MAX_AVATARS).map(meme => (
            <AssetAvatar
              key={`${meme.chain}:${meme.id}`}
              logo={meme.logoUrl}
              chain={meme.chain}
              size={28}
              chainSize={12}
              logoStyle={styles.memeLogo}
            />
          ))}
          {overflow ? (
            <View style={styles.more}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          ) : null}
        </View>
        <Text style={styles.memeCount}>
          {overflow
            ? t('page.memeCoin.buy.totalMemes', { count: memes.length })
            : t('page.memeCoin.buy.memes', { count: memes.length })}
        </Text>
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
    marginTop: 14,
    marginBottom: 14,
  },
  memeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memeLogo: {
    borderRadius: 8,
  },
  more: {
    width: 28,
    height: 28,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors2024['neutral-secondary'],
  },
  memeCount: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
}));
