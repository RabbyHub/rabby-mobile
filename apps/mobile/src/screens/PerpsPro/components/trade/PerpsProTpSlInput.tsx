import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProTpSlMode } from '../../model/tpsl';
import {
  sanitizePerpsProPriceEditingInput,
  sanitizePerpsProPriceInput,
} from '../../model/trade';
import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';
import { resolvePerpsProFieldBackground } from '../common/perpsProVisual';
import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';
import {
  PerpsProAnimatedPriceTextInput,
  usePerpsProPriceFillAnimation,
} from './usePerpsProPriceFillAnimation';

const NEGATIVE_PREFIX_SLOT_WIDTH = 9;

export const PerpsProTpSlInput: React.FC<{
  fillRevision?: number;
  kind: 'sl' | 'tp';
  label: string;
  maxDecimals: number;
  mode: PerpsProTpSlMode;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onPressMode: () => void;
  priceSzDecimals?: number;
  quoteAsset: string;
  value: string;
}> = React.memo(
  ({
    fillRevision = 0,
    kind,
    label,
    maxDecimals,
    mode,
    onBlur,
    onChangeText,
    onFocus,
    onPressMode,
    priceSzDecimals,
    quoteAsset,
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const [focused, setFocused] = useState(false);
    const animatedInputStyle = usePerpsProPriceFillAnimation(fillRevision);
    const [measuredValue, setMeasuredValue] = useState({
      text: '',
      width: 0,
    });
    const modeLabel = t(
      `page.perps.pro.trade.${mode === 'roi' ? 'roiInput' : mode}`,
    );
    const unitLabel = mode === 'roi' ? '%' : quoteAsset;
    const showNegativePrefix = kind === 'sl' && mode !== 'price' && !!value;
    const showFloatingLabel = focused || !!value;
    const measuredValueWidth =
      measuredValue.text === value ? measuredValue.width : 0;
    const handleValueLayout = useCallback(
      (event: LayoutChangeEvent) => {
        const nextWidth = event.nativeEvent.layout.width;
        setMeasuredValue(current =>
          current.text === value && current.width === nextWidth
            ? current
            : { text: value, width: nextWidth },
        );
      },
      [value],
    );
    const normalizePriceEditingInput = useCallback(
      (next: string) =>
        priceSzDecimals == null
          ? next
          : sanitizePerpsProPriceEditingInput(next, priceSzDecimals),
      [priceSzDecimals],
    );
    const canonicalizePriceInput = useCallback(
      (next: string) =>
        priceSzDecimals == null
          ? next
          : sanitizePerpsProPriceInput(next, priceSzDecimals),
      [priceSzDecimals],
    );
    const usesPriceEditingPolicy = mode === 'price' && priceSzDecimals != null;
    return (
      <View style={styles.container}>
        <Text style={styles.legLabel}>{label}</Text>
        <View style={styles.field} testID={`perps-pro-tpsl-${kind}-field`}>
          <View style={styles.inputArea}>
            {showFloatingLabel ? (
              <Text
                pointerEvents="none"
                style={styles.floatingLabel}
                testID={`perps-pro-tpsl-${kind}-label`}>
                {modeLabel}
              </Text>
            ) : (
              <Text
                pointerEvents="none"
                style={styles.centeredPlaceholder}
                testID={`perps-pro-tpsl-${kind}-placeholder`}>
                {modeLabel}
              </Text>
            )}
            {showNegativePrefix ? (
              <>
                <Text
                  accessible={false}
                  numberOfLines={1}
                  onLayout={handleValueLayout}
                  pointerEvents="none"
                  style={styles.valueMeasure}
                  testID={`perps-pro-tpsl-${kind}-value-measure`}>
                  {value}
                </Text>
                <Text
                  pointerEvents="none"
                  style={[
                    styles.negativePrefix,
                    measuredValueWidth > 0
                      ? {
                          transform: [
                            {
                              translateX:
                                -measuredValueWidth / 2 -
                                NEGATIVE_PREFIX_SLOT_WIDTH / 2,
                            },
                          ],
                        }
                      : styles.unmeasuredNegativePrefix,
                  ]}
                  testID={`perps-pro-tpsl-${kind}-negative-prefix`}>
                  −
                </Text>
              </>
            ) : null}
            <PerpsProDecimalTextInput
              accessibilityLabel={label}
              canonicalizeValueOnBlur={
                usesPriceEditingPolicy ? canonicalizePriceInput : undefined
              }
              cursorColor={colors2024['brand-default']}
              inputComponent={PerpsProAnimatedPriceTextInput}
              maxFontSizeMultiplier={1.2}
              maxDecimals={maxDecimals}
              normalizeValue={
                usesPriceEditingPolicy ? normalizePriceEditingInput : undefined
              }
              onBlur={() => {
                setFocused(false);
                onBlur();
              }}
              onChangeText={onChangeText}
              onFocus={() => {
                setFocused(true);
                onFocus();
              }}
              preserveIntegerZeroRun={usesPriceEditingPolicy}
              selectionColor={colors2024['brand-default']}
              style={[
                styles.input,
                showNegativePrefix ? styles.inputWithNegativePrefix : null,
                animatedInputStyle,
              ]}
              testID={`perps-pro-tpsl-${kind}-input`}
              value={value}
            />
          </View>
          <Pressable
            accessibilityLabel={`${label} mode`}
            accessibilityRole="button"
            onPress={onPressMode}
            style={styles.mode}
            testID={`perps-pro-tpsl-${kind}-mode`}>
            <View
              style={styles.modeContent}
              testID={`perps-pro-tpsl-${kind}-mode-content`}>
              <Text
                numberOfLines={1}
                style={styles.modeText}
                testID={`perps-pro-tpsl-${kind}-unit`}>
                {unitLabel}
              </Text>
              <PerpsProSelectCaret
                color={colors2024['neutral-secondary']}
                testID={`perps-pro-tpsl-${kind}-caret`}
              />
            </View>
          </Pressable>
        </View>
      </View>
    );
  },
);

PerpsProTpSlInput.displayName = 'PerpsProTpSlInput';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: { gap: 4, minWidth: 0 },
  legLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  field: {
    alignItems: 'center',
    backgroundColor: resolvePerpsProFieldBackground({
      darkBackground: colors2024['neutral-bg-5'],
      isLight,
    }),
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    height: 40,
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  inputArea: { flex: 1, height: '100%', minWidth: 0, position: 'relative' },
  floatingLabel: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    fontWeight: '500',
    left: 0,
    lineHeight: 12,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 4,
  },
  centeredPlaceholder: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro',
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
  inputWithNegativePrefix: { paddingLeft: NEGATIVE_PREFIX_SLOT_WIDTH },
  valueMeasure: {
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    left: 0,
    lineHeight: 18,
    opacity: 0,
    position: 'absolute',
    top: 0,
  },
  negativePrefix: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    includeFontPadding: false,
    left: '50%',
    lineHeight: 18,
    position: 'absolute',
    top: 18,
  },
  unmeasuredNegativePrefix: { opacity: 0 },
  mode: {
    borderLeftColor: colors2024['neutral-line'],
    borderLeftWidth: 1,
    height: 24,
    width: 52,
  },
  modeContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    height: 16,
    left: 4,
    position: 'absolute',
    top: 4,
    width: 46,
  },
  modeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    width: 36,
  },
}));
