import RcPrecisionCaret from '@/assets2024/icons/perps/PerpsProPrecisionCaret.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProTpSlMode } from '../../model/tpsl';
import { PerpsProDecimalTextInput } from './PerpsProDecimalTextInput';

const NEGATIVE_PREFIX_SLOT_WIDTH = 9;

export const PerpsProTpSlInput: React.FC<{
  kind: 'sl' | 'tp';
  label: string;
  maxDecimals: number;
  mode: PerpsProTpSlMode;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onPressMode: () => void;
  quoteAsset: string;
  value: string;
}> = React.memo(
  ({
    kind,
    label,
    maxDecimals,
    mode,
    onBlur,
    onChangeText,
    onFocus,
    onPressMode,
    quoteAsset,
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const [focused, setFocused] = useState(false);
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
              cursorColor={colors2024['brand-default']}
              maxFontSizeMultiplier={1.2}
              maxDecimals={maxDecimals}
              onBlur={() => {
                setFocused(false);
                onBlur();
              }}
              onChangeText={onChangeText}
              onFocus={() => {
                setFocused(true);
                onFocus();
              }}
              selectionColor={colors2024['brand-default']}
              style={[
                styles.input,
                showNegativePrefix ? styles.inputWithNegativePrefix : null,
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
              <View
                style={styles.caret}
                testID={`perps-pro-tpsl-${kind}-caret`}>
                <RcPrecisionCaret
                  color={colors2024['neutral-secondary']}
                  height={6}
                  width={8}
                />
              </View>
            </View>
          </Pressable>
        </View>
      </View>
    );
  },
);

PerpsProTpSlInput.displayName = 'PerpsProTpSlInput';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: { gap: 4, minWidth: 0 },
  legLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  field: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
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
    left: 6,
    position: 'absolute',
    top: 4,
    width: 44,
  },
  modeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    width: 34,
  },
  caret: {
    height: 6,
    transform: [{ rotate: '180deg' }],
    width: 8,
  },
}));
