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

import type { PerpsProFieldExplanationKey } from '../../model/fieldExplanation';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';
import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';
import {
  getPerpsProIsolatedTextStyle,
  getPerpsProTradeControlMediumTextStyle,
  resolvePerpsProFieldBackground,
} from '../common/perpsProVisual';

export const getPerpsProTradeSelectFontStyle = (
  platform: typeof Platform.OS,
): TextStyle => ({
  ...getPerpsProTradeControlMediumTextStyle(platform),
  ...getPerpsProIsolatedTextStyle(platform),
});

const tradeSelectFontStyle = getPerpsProTradeSelectFontStyle(Platform.OS);
const tradeSelectPlainFontStyle = getPerpsProTradeControlMediumTextStyle(
  Platform.OS,
);

export const PerpsProTradeSelect: React.FC<{
  label: string;
  disabled?: boolean;
  onPress?: () => void;
  showCaret?: boolean;
  style?: ViewStyle;
  textStyle?: StyleProp<TextStyle>;
  useReadableTextVariant?: boolean;
}> = React.memo(
  ({
    disabled,
    label,
    onPress,
    showCaret = true,
    style,
    textStyle,
    useReadableTextVariant = true,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={[styles.select, disabled ? styles.disabled : null, style]}>
        <Text
          numberOfLines={1}
          style={[
            styles.selectText,
            useReadableTextVariant
              ? tradeSelectFontStyle
              : tradeSelectPlainFontStyle,
            textStyle,
          ]}>
          {label}
        </Text>
        {showCaret ? (
          <View style={styles.caret}>
            <PerpsProSelectCaret
              color={colors2024['neutral-secondary']}
              testID="perps-pro-trade-select-caret"
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
  explanationKey?: PerpsProFieldExplanationKey;
  label: string;
  onPressValue?: () => void;
  trailing?: React.ReactNode;
  value: string;
  valueTestID?: string;
}> = React.memo(
  ({
    dottedLabel = false,
    explanationKey,
    label,
    onPressValue,
    trailing,
    value,
    valueTestID,
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const openFieldExplanation = usePerpsProFieldExplanation();
    const ValueContainer = onPressValue ? Pressable : View;
    return (
      <View style={styles.summaryRow}>
        {dottedLabel ? (
          <PerpsProDottedUnderlineText
            accessibilityLabel={label}
            onPress={
              explanationKey
                ? () => openFieldExplanation(explanationKey)
                : undefined
            }
            style={styles.summaryLabel}>
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
  explanationKey?: PerpsProFieldExplanationKey;
  label: string;
  onPress?: () => void;
}> = React.memo(
  ({ checked = false, disabled, explanationKey, label, onPress }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const openFieldExplanation = usePerpsProFieldExplanation();
    return (
      <View style={styles.checkboxRow}>
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled }}
          disabled={disabled}
          hitSlop={{ bottom: 8, left: 8, right: 0, top: 8 }}
          onPress={onPress}
          style={disabled ? styles.disabled : undefined}
          testID={`perps-pro-trade-checkbox-${label}`}>
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
        </Pressable>
        <PerpsProDottedUnderlineText
          accessibilityLabel={label}
          containerStyle={disabled ? styles.disabled : undefined}
          onPress={
            explanationKey
              ? () => openFieldExplanation(explanationKey)
              : undefined
          }
          style={styles.checkboxLabel}>
          {label}
        </PerpsProDottedUnderlineText>
      </View>
    );
  },
);

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
        <Text style={styles.tradeButtonText}>{label}</Text>
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

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  select: {
    alignItems: 'center',
    backgroundColor: resolvePerpsProFieldBackground({
      darkBackground: colors2024['neutral-bg-5'],
      isLight,
    }),
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
    color: colors2024['neutral-title-2'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  tradeButtonSubtitle: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '400',
  },
}));
