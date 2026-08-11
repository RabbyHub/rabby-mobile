import RcIconAmountUnitArrow from '@/assets2024/icons/perps/PerpsProAmountUnitArrow.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';
import { getPerpsProTradeSelectFontStyle } from './PerpsProTradePrimitives';

const conditionalSuffixFontStyle = getPerpsProTradeSelectFontStyle(Platform.OS);

export const PerpsProTradePriceField: React.FC<{
  editable?: boolean;
  label: string;
  maxDecimals: number;
  onChangeText: (value: string) => void;
  onPressSuffix?: () => void;
  onPressValue?: () => void;
  suffix?: string;
  suffixActive?: boolean;
  value: string;
  variant?: 'default' | 'conditionalExecution';
}> = React.memo(
  ({
    editable = true,
    label,
    maxDecimals,
    onChangeText,
    onPressSuffix,
    onPressValue,
    suffix,
    suffixActive = false,
    value,
    variant = 'default',
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const [focused, setFocused] = useState(false);
    const showFloatingLabel = focused || !!value;
    return (
      <View style={styles.container} testID="perps-pro-trade-price-field">
        <Pressable
          accessibilityRole={onPressValue ? 'button' : undefined}
          onPress={onPressValue}
          style={[
            styles.fieldArea,
            variant === 'conditionalExecution' && !editable
              ? styles.conditionalDisabledField
              : null,
          ]}
          testID={
            variant === 'conditionalExecution'
              ? 'perps-pro-trade-conditional-execution-value'
              : undefined
          }>
          <View style={styles.inputArea}>
            {showFloatingLabel ? (
              <Text
                pointerEvents="none"
                style={styles.label}
                testID="perps-pro-trade-price-label">
                {label}
              </Text>
            ) : (
              <Text
                numberOfLines={1}
                pointerEvents="none"
                style={styles.centeredPlaceholder}
                testID="perps-pro-trade-price-placeholder">
                {label}
              </Text>
            )}
            <PerpsProDecimalTextInput
              accessibilityLabel={label}
              cursorColor={colors2024['brand-default']}
              editable={editable}
              maxFontSizeMultiplier={1.2}
              maxDecimals={maxDecimals}
              onBlur={() => setFocused(false)}
              onChangeText={onChangeText}
              onFocus={() => setFocused(true)}
              pointerEvents={onPressValue ? 'none' : 'auto'}
              selectionColor={colors2024['brand-default']}
              style={styles.input}
              value={value}
            />
          </View>
        </Pressable>
        {suffix ? (
          <Pressable
            accessibilityRole={onPressSuffix ? 'button' : undefined}
            disabled={!onPressSuffix}
            onPress={onPressSuffix}
            style={[
              styles.suffixArea,
              variant === 'conditionalExecution'
                ? styles.conditionalSuffixArea
                : null,
              suffixActive ? styles.suffixActive : null,
              !onPressSuffix ? styles.disabledSuffix : null,
            ]}
            testID={`perps-pro-trade-price-suffix-${suffix}`}>
            <Text
              numberOfLines={1}
              style={[
                styles.suffix,
                variant === 'conditionalExecution'
                  ? [styles.conditionalSuffix, conditionalSuffixFontStyle]
                  : null,
              ]}>
              {suffix}
            </Text>
            {variant === 'conditionalExecution' ? (
              <View
                pointerEvents="none"
                style={styles.switchIcon}
                testID="perps-pro-trade-conditional-execution-switch">
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
            ) : null}
          </Pressable>
        ) : null}
      </View>
    );
  },
);

PerpsProTradePriceField.displayName = 'PerpsProTradePriceField';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 40,
  },
  fieldArea: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    height: 40,
    minWidth: 0,
    overflow: 'hidden',
  },
  inputArea: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    paddingHorizontal: 8,
    position: 'relative',
  },
  label: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    left: 8,
    lineHeight: 12,
    position: 'absolute',
    right: 8,
    textAlign: 'center',
    top: 4,
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
  centeredPlaceholder: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    left: 8,
    lineHeight: 16,
    position: 'absolute',
    right: 8,
    textAlign: 'center',
    top: 12,
  },
  suffixArea: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
    width: 60,
  },
  conditionalSuffixArea: {
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
  },
  suffix: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  suffixActive: {
    borderColor: colors2024['neutral-title-1'],
    borderWidth: 1,
  },
  disabledSuffix: {
    opacity: 0.45,
  },
  conditionalDisabledField: {
    opacity: 0.5,
  },
  conditionalSuffix: {
    fontSize: 10,
    lineHeight: 12,
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
