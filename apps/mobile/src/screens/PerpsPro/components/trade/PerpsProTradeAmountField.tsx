import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import RcIconAmountUnitSwitch from '@/assets2024/icons/perps/PerpsProAmountUnitSwitch.svg';
import { Text, type TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { Platform, Pressable, View, type TextInputProps } from 'react-native';

import { getPerpsProTradeControlMediumTextStyle } from '../common/perpsProVisual';
import { PERPS_PRO_TRADE_AMOUNT_FIELD_HEIGHT } from '../../model/layout';
import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';

const noop = () => undefined;
const unitFontStyle = getPerpsProTradeControlMediumTextStyle(Platform.OS);
const UNIT_AREA_MIN_WIDTH = 63;
const UNIT_AREA_MAX_WIDTH = 72;
const UNIT_TEXT_MIN_WIDTH = 34;

type PerpsProTradeAmountFieldProps = {
  invalid?: boolean;
  getKeyboardMinimum?: () => string | null;
  inputMode?: TextInputProps['inputMode'];
  keyboardType?: TextInputProps['keyboardType'];
  label: string;
  maxDecimals: number;
  onChangeText?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onPressIn?: () => void;
  onToggleUnit?: () => void;
  unit?: string;
  value?: string;
  variant?: 'default' | 'compact';
};

export const PerpsProTradeAmountField = React.memo(
  React.forwardRef<TextInput, PerpsProTradeAmountFieldProps>(
    (props, forwardedRef) => {
      const {
        invalid,
        getKeyboardMinimum,
        inputMode,
        keyboardType,
        label,
        maxDecimals,
        onBlur,
        onChangeText,
        onFocus,
        onPressIn,
        onToggleUnit,
        unit,
        value = '',
        variant = 'default',
      } = props;
      const { colors2024, styles } = useTheme2024({ getStyle });
      const [focused, setFocused] = useState(false);
      const showFloatingLabel = focused || !!value;

      return (
        <View
          style={[
            styles.container,
            invalid && styles.invalid,
            variant === 'compact' && styles.compactHeight,
          ]}
          testID="perps-pro-trade-amount-field">
          <View style={styles.amountArea}>
            {showFloatingLabel ? (
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                pointerEvents={variant === 'compact' ? 'none' : undefined}
                style={[
                  styles.floatingLabel,
                  variant === 'compact' && styles.compactFloatingLabel,
                ]}
                testID="perps-pro-amount-label">
                {label}
              </Text>
            ) : (
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                pointerEvents="none"
                style={[
                  styles.centeredPlaceholder,
                  variant === 'compact' && styles.compactPlaceholder,
                ]}
                testID="perps-pro-amount-placeholder">
                {label}
              </Text>
            )}
            <PerpsProDecimalTextInput
              getKeyboardMinimum={getKeyboardMinimum}
              keyboardScrollTrade
              accessibilityLabel={label}
              inputMode={inputMode}
              keyboardType={keyboardType}
              maxFontSizeMultiplier={1.2}
              maxDecimals={maxDecimals}
              ref={forwardedRef}
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
              style={[
                styles.input,
                variant === 'compact' && styles.compactHeight,
              ]}
              value={value}
            />
          </View>
          {unit !== undefined ? (
            <Pressable
              accessibilityRole="button"
              onPress={onToggleUnit}
              style={styles.unitArea}
              testID="perps-pro-trade-amount-unit">
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={[styles.unit, unitFontStyle]}>
                {unit}
              </Text>
              <RcIconAmountUnitSwitch
                color={colors2024['neutral-secondary']}
                height={10}
                pointerEvents="none"
                testID="perps-pro-trade-amount-unit-switch"
                width={10}
              />
            </Pressable>
          ) : null}
        </View>
      );
    },
  ),
);

PerpsProTradeAmountField.displayName = 'PerpsProTradeAmountField';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  invalid: { borderWidth: 1, borderColor: colors2024['red-default'] },
  compactHeight: { height: 34 },
  compactFloatingLabel: { top: 2 },
  compactPlaceholder: { top: 8 },
  container: {
    alignItems: 'center',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-5'],
    borderRadius: 6,
    borderCurve: 'continuous',
    flexDirection: 'row',
    gap: 4,
    height: PERPS_PRO_TRADE_AMOUNT_FIELD_HEIGHT,
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
    top: 12,
  },
  input: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    height: PERPS_PRO_TRADE_AMOUNT_FIELD_HEIGHT,
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
    flexShrink: 0,
    gap: 4,
    height: 26,
    maxWidth: UNIT_AREA_MAX_WIDTH,
    minWidth: UNIT_AREA_MIN_WIDTH,
    paddingLeft: 10,
    paddingRight: 4,
  },
  unit: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 18,
    minWidth: UNIT_TEXT_MIN_WIDTH,
    textAlign: 'center',
  },
}));
