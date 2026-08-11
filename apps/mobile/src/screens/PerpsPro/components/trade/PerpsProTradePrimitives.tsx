import RcPrecisionCaret from '@/assets2024/icons/perps/PerpsProPrecisionCaret.svg';
import RcIconCheckboxEmpty from '@/assets2024/icons/common/checkbox-empty-cc.svg';
import RcIconCheckboxFilled from '@/assets2024/icons/common/checkbox-filled-brand.svg';
import { Text } from '@/components/Typography';
import { FontNames } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import {
  Platform,
  Pressable,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';

export const getPerpsProTradeSelectFontStyle = (
  platform: typeof Platform.OS,
): TextStyle =>
  platform === 'android'
    ? { fontFamily: 'SF-Pro-Rounded-Medium' }
    : { fontFamily: 'SF Pro', fontWeight: '500' };

const tradeSelectFontStyle = getPerpsProTradeSelectFontStyle(Platform.OS);

export const PerpsProTradeSelect: React.FC<{
  label: string;
  disabled?: boolean;
  onPress?: () => void;
  showCaret?: boolean;
  style?: ViewStyle;
  textStyle?: StyleProp<TextStyle>;
}> = React.memo(
  ({ disabled, label, onPress, showCaret = true, style, textStyle }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={[styles.select, disabled ? styles.disabled : null, style]}>
        <Text
          numberOfLines={1}
          style={[styles.selectText, tradeSelectFontStyle, textStyle]}>
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
      </Pressable>
    );
  },
);

PerpsProTradeSelect.displayName = 'PerpsProTradeSelect';

export const PerpsProTradeSummaryRow: React.FC<{
  dottedLabel?: boolean;
  label: string;
  onPressValue?: () => void;
  trailing?: React.ReactNode;
  value: string;
  valueTestID?: string;
}> = React.memo(
  ({
    dottedLabel = false,
    label,
    onPressValue,
    trailing,
    value,
    valueTestID,
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const ValueContainer = onPressValue ? Pressable : View;
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
        <ValueContainer
          accessibilityRole={onPressValue ? 'button' : undefined}
          hitSlop={onPressValue ? 8 : undefined}
          onPress={onPressValue}
          style={styles.summaryValueGroup}
          testID={valueTestID}>
          <Text numberOfLines={1} style={styles.summaryValue}>
            {value}
          </Text>
          {trailing}
        </ValueContainer>
      </View>
    );
  },
);

PerpsProTradeSummaryRow.displayName = 'PerpsProTradeSummaryRow';

export const PerpsProTradeCheckbox: React.FC<{
  checked?: boolean;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}> = React.memo(({ checked = false, disabled, label, onPress }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.checkboxRow, disabled ? styles.disabled : null]}>
      {checked ? (
        <RcIconCheckboxFilled
          height={20}
          testID="perps-pro-trade-checkbox-icon"
          width={20}
        />
      ) : (
        <RcIconCheckboxEmpty
          color={colors2024['neutral-secondary']}
          height={20}
          testID="perps-pro-trade-checkbox-icon"
          width={20}
        />
      )}
      <PerpsProDottedUnderlineText style={styles.checkboxLabel}>
        {label}
      </PerpsProDottedUnderlineText>
    </Pressable>
  );
});

PerpsProTradeCheckbox.displayName = 'PerpsProTradeCheckbox';

export const PerpsProTradeButton: React.FC<{
  label: string;
  disabled?: boolean;
  onPress?: () => void;
  side: 'buy' | 'sell';
  subtitle?: string;
}> = React.memo(({ disabled, label, onPress, side, subtitle }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tradeButton,
        subtitle ? styles.tradeButtonWithSubtitle : null,
        side === 'buy' ? styles.buyButton : styles.sellButton,
        disabled ? styles.disabled : null,
      ]}
      testID={`perps-pro-trade-button-${side}`}>
      <View style={styles.tradeButtonCopy}>
        <Text
          style={[
            styles.tradeButtonText,
            subtitle ? styles.tradeButtonTextWithSubtitle : null,
          ]}>
          {label}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={styles.tradeButtonSubtitle}
            testID={`perps-pro-trade-button-${side}-amount`}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
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
    fontFamily: FontNames.sf_pro,
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
  disabled: {
    opacity: 0.5,
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
  tradeButtonWithSubtitle: { height: 40 },
  tradeButtonCopy: { alignItems: 'center', gap: 2 },
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
  tradeButtonTextWithSubtitle: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro',
  },
  tradeButtonSubtitle: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '400',
  },
}));
