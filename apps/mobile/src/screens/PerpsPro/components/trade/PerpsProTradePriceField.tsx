import RcIconAmountUnitSwitch from '@/assets2024/icons/perps/PerpsProAmountUnitSwitch.svg';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { resolvePerpsProFieldBackground } from '../common/perpsProVisual';
import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';
import { getPerpsProTradeSelectFontStyle } from './PerpsProTradePrimitives';
import {
  PerpsProAnimatedPriceTextInput,
  usePerpsProPriceFillAnimation,
} from './usePerpsProPriceFillAnimation';

export { PERPS_PRO_PRICE_FILL_ANIMATION } from './usePerpsProPriceFillAnimation';

const suffixFontStyle = getPerpsProTradeSelectFontStyle(Platform.OS);

type PerpsProTradePriceFieldProps = {
  editable?: boolean;
  fillRevision?: number;
  label: string;
  maxDecimals: number;
  onChangeText: (value: string) => void;
  onPressSuffix?: () => void;
  onPressValue?: () => void;
  suffix?: string;
  suffixActive?: boolean;
  value: string;
  variant?: 'default' | 'conditionalExecution';
};

export const PerpsProTradePriceField = React.memo(
  React.forwardRef<TextInput, PerpsProTradePriceFieldProps>((props, ref) => {
    const {
      editable = true,
      fillRevision = 0,
      label,
      maxDecimals,
      onChangeText,
      onPressSuffix,
      onPressValue,
      suffix,
      suffixActive = false,
      value,
      variant = 'default',
    } = props;
    const { colors2024, styles } = useTheme2024({ getStyle });
    const [focused, setFocused] = useState(false);
    const animatedInputStyle = usePerpsProPriceFillAnimation(fillRevision);
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
              inputComponent={PerpsProAnimatedPriceTextInput}
              maxFontSizeMultiplier={1.2}
              maxDecimals={maxDecimals}
              ref={ref}
              onBlur={() => setFocused(false)}
              onChangeText={onChangeText}
              onFocus={() => setFocused(true)}
              pointerEvents={onPressValue ? 'none' : 'auto'}
              selectionColor={colors2024['brand-default']}
              style={[styles.input, animatedInputStyle]}
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
                suffixFontStyle,
                variant === 'conditionalExecution'
                  ? styles.conditionalSuffix
                  : null,
              ]}>
              {suffix}
            </Text>
            {variant === 'conditionalExecution' ? (
              <RcIconAmountUnitSwitch
                color={colors2024['neutral-secondary']}
                height={10}
                pointerEvents="none"
                testID="perps-pro-trade-conditional-execution-switch"
                width={10}
              />
            ) : null}
          </Pressable>
        ) : null}
      </View>
    );
  }),
);

PerpsProTradePriceField.displayName = 'PerpsProTradePriceField';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 40,
  },
  fieldArea: {
    alignItems: 'center',
    backgroundColor: resolvePerpsProFieldBackground({
      darkBackground: colors2024['neutral-bg-5'],
      isLight,
    }),
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
    fontFamily: 'SF Pro',
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
    fontFamily: 'SF Pro',
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
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    left: 8,
    lineHeight: 18,
    position: 'absolute',
    right: 8,
    textAlign: 'center',
    top: 11,
  },
  suffixArea: {
    alignItems: 'center',
    backgroundColor: resolvePerpsProFieldBackground({
      darkBackground: colors2024['neutral-bg-5'],
      isLight,
    }),
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
    fontFamily: 'SF Pro',
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
}));
