import RcAccountCaret from '@/assets2024/icons/perps/PerpsHeaderAccountCaret.svg';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import { Text } from '@/components/Typography';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { FontNames } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';

export const PerpsAccountTrigger: React.FC<{
  address?: string;
  brandName?: string;
  expanded: boolean;
  label: string;
  onPress: () => void;
  variant?: 'compact' | 'wallet';
}> = React.memo(
  ({ address, brandName, expanded, label, onPress, variant = 'compact' }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const walletVariant = variant === 'wallet' && !!address;
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={[
          styles.trigger,
          walletVariant ? styles.walletTrigger : styles.compactTrigger,
        ]}
        testID="perps-account-trigger">
        {walletVariant ? (
          <WalletIcon
            address={address}
            height={18}
            type={brandName}
            width={18}
          />
        ) : null}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            walletVariant ? styles.walletLabel : styles.compactLabel,
          ]}>
          {label}
        </Text>
        {walletVariant ? (
          <CaretArrowIconCC
            bgColor={colors2024['neutral-bg-5']}
            dir="down"
            height={14}
            lineColor={colors2024['neutral-title-1']}
            style={expanded ? styles.walletExpandedCaret : null}
            width={14}
          />
        ) : (
          <View style={[styles.caret, expanded ? styles.expandedCaret : null]}>
            <RcAccountCaret color={colors2024['neutral-foot']} />
          </View>
        )}
      </Pressable>
    );
  },
);

PerpsAccountTrigger.displayName = 'PerpsAccountTrigger';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  trigger: {
    alignItems: 'center',
    borderColor: colors2024['neutral-line'],
    borderWidth: 1,
    flexDirection: 'row',
  },
  compactTrigger: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 6,
    gap: 2,
    height: 26,
    maxWidth: 108,
    paddingHorizontal: 6,
  },
  walletTrigger: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 8,
    flexShrink: 1,
    gap: 4,
    height: 32,
    maxWidth: 180,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  label: {
    color: colors2024['neutral-foot'],
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  compactLabel: {
    fontFamily: FontNames.sf_pro,
    fontWeight: '400',
    includeFontPadding: false,
  },
  walletLabel: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    minWidth: 0,
  },
  caret: {
    alignItems: 'center',
    height: 8,
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
    width: 10,
  },
  expandedCaret: {
    transform: [{ rotate: '0deg' }],
  },
  walletExpandedCaret: {
    transform: [{ rotate: '180deg' }],
  },
}));
