import RcPrecisionCaret from '@/assets2024/icons/perps/PerpsProPrecisionCaret.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';

export const PerpsProTradeSelect: React.FC<{
  label: string;
  showCaret?: boolean;
  style?: ViewStyle;
}> = React.memo(({ label, showCaret = true, style }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.select, style]}>
      <Text numberOfLines={1} style={styles.selectText}>
        {label}
      </Text>
      {showCaret ? (
        <View style={styles.caret} testID="perps-pro-trade-select-caret">
          <RcPrecisionCaret
            color={colors2024['neutral-secondary']}
            height={6}
            width={8}
          />
        </View>
      ) : null}
    </View>
  );
});

PerpsProTradeSelect.displayName = 'PerpsProTradeSelect';

export const PerpsProTradeSummaryRow: React.FC<{
  dottedLabel?: boolean;
  label: string;
  trailing?: React.ReactNode;
  value: string;
}> = React.memo(({ dottedLabel = false, label, trailing, value }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.summaryRow}>
      {dottedLabel ? (
        <PerpsProDottedUnderlineText style={styles.summaryLabel}>
          {label}
        </PerpsProDottedUnderlineText>
      ) : (
        <Text numberOfLines={1} style={styles.summaryLabel}>
          {label}
        </Text>
      )}
      <View style={styles.summaryValueGroup}>
        <Text numberOfLines={1} style={styles.summaryValue}>
          {value}
        </Text>
        {trailing}
      </View>
    </View>
  );
});

PerpsProTradeSummaryRow.displayName = 'PerpsProTradeSummaryRow';

export const PerpsProTradeCheckbox: React.FC<{ label: string }> = React.memo(
  ({ label }) => {
    const { styles } = useTheme2024({ getStyle });
    return (
      <View style={styles.checkboxRow}>
        <View style={styles.checkbox} />
        <PerpsProDottedUnderlineText style={styles.checkboxLabel}>
          {label}
        </PerpsProDottedUnderlineText>
      </View>
    );
  },
);

PerpsProTradeCheckbox.displayName = 'PerpsProTradeCheckbox';

export const PerpsProTradeButton: React.FC<{
  label: string;
  side: 'buy' | 'sell';
}> = React.memo(({ label, side }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View
      style={[
        styles.tradeButton,
        side === 'buy' ? styles.buyButton : styles.sellButton,
      ]}>
      <Text style={styles.tradeButtonText}>{label}</Text>
    </View>
  );
});

PerpsProTradeButton.displayName = 'PerpsProTradeButton';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  select: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    flexDirection: 'row',
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  selectText: {
    color: colors2024['neutral-title-1'],
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    minWidth: 0,
    textAlign: 'center',
  },
  caret: {
    marginLeft: 4,
    transform: [{ rotate: '180deg' }],
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 16,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors2024['neutral-secondary'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  summaryValue: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    minWidth: 0,
    textAlign: 'right',
  },
  summaryValueGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
    justifyContent: 'flex-end',
    marginLeft: 4,
    minWidth: 0,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 20,
  },
  checkbox: {
    borderColor: colors2024['neutral-line'],
    borderRadius: 4,
    borderWidth: 1,
    height: 20,
    width: 20,
  },
  checkboxLabel: {
    color: colors2024['neutral-body'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  tradeButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
  },
  buyButton: {
    backgroundColor: colors2024['green-default'],
  },
  sellButton: {
    backgroundColor: colors2024['red-default'],
  },
  tradeButtonText: {
    color: colors2024['neutral-bg-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
