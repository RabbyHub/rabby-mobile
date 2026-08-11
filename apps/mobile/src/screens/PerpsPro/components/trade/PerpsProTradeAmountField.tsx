import RcIconAmountUnitArrow from '@/assets2024/icons/perps/PerpsProAmountUnitArrow.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';

const noop = () => undefined;

export const PerpsProTradeAmountField: React.FC<{
  label: string;
  maxDecimals: number;
  onChangeText?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onPressIn?: () => void;
  onToggleUnit?: () => void;
  unit: string;
  value?: string;
}> = React.memo(
  ({
    label,
    maxDecimals,
    onBlur,
    onChangeText,
    onFocus,
    onPressIn,
    onToggleUnit,
    unit,
    value = '',
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const [focused, setFocused] = useState(false);
    const showFloatingLabel = focused || !!value;

    return (
      <View style={styles.container} testID="perps-pro-trade-amount-field">
        <View style={styles.amountArea}>
          {showFloatingLabel ? (
            <Text style={styles.floatingLabel} testID="perps-pro-amount-label">
              {label}
            </Text>
          ) : (
            <Text
              pointerEvents="none"
              style={styles.centeredPlaceholder}
              testID="perps-pro-amount-placeholder">
              {label}
            </Text>
          )}
          <PerpsProDecimalTextInput
            accessibilityLabel={label}
            cursorColor={colors2024['brand-default']}
            maxFontSizeMultiplier={1.2}
            maxDecimals={maxDecimals}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChangeText={onChangeText ?? noop}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
            onPressIn={onPressIn}
            selectionColor={colors2024['brand-default']}
            style={styles.input}
            value={value}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onToggleUnit}
          style={styles.unitArea}
          testID="perps-pro-trade-amount-unit">
          <Text numberOfLines={1} style={styles.unit}>
            {unit}
          </Text>
          <View pointerEvents="none" style={styles.switchIcon}>
            <RcIconAmountUnitArrow
              color={colors2024['neutral-secondary']}
              height={4.5}
              style={styles.switchArrowTop}
              width={8}
            />
            <RcIconAmountUnitArrow
              color={colors2024['neutral-secondary']}
              height={4.5}
              style={styles.switchArrowBottom}
              width={8}
            />
          </View>
        </Pressable>
      </View>
    );
  },
);

PerpsProTradeAmountField.displayName = 'PerpsProTradeAmountField';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  amountArea: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    position: 'relative',
  },
  floatingLabel: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '400',
    left: 0,
    lineHeight: 12,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 4,
  },
  centeredPlaceholder: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    left: 0,
    lineHeight: 18,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 11,
  },
  input: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    height: 40,
    includeFontPadding: false,
    lineHeight: 18,
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 12,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  unitArea: {
    alignItems: 'center',
    borderLeftColor: colors2024['neutral-line'],
    borderLeftWidth: 1,
    flexDirection: 'row',
    gap: 2,
    height: 24,
    paddingLeft: 5,
    width: 52,
  },
  unit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    width: 34,
  },
  switchIcon: {
    height: 10,
    position: 'relative',
    width: 10,
  },
  switchArrowTop: {
    left: 1,
    position: 'absolute',
    top: 0,
    transform: [{ rotate: '180deg' }],
  },
  switchArrowBottom: {
    bottom: 0,
    left: 1,
    position: 'absolute',
  },
}));
