import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProTpSlMode } from '../../model/tpsl';

export const PerpsProTpSlInput: React.FC<{
  error?: string | null;
  kind: 'sl' | 'tp';
  label: string;
  mode: PerpsProTpSlMode;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onPressMode: () => void;
  value: string;
}> = React.memo(
  ({
    error,
    kind,
    label,
    mode,
    onBlur,
    onChangeText,
    onFocus,
    onPressMode,
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const [focused, setFocused] = useState(false);
    const modeLabel = t(`page.perps.pro.trade.${mode}`);
    const showNegativePrefix = kind === 'sl' && mode !== 'price' && !!value;
    const showFloatingLabel = focused || !!value;
    return (
      <View style={styles.container}>
        <Text style={styles.legLabel}>{label}</Text>
        <View style={[styles.field, error ? styles.fieldError : null]}>
          <View style={styles.inputArea}>
            {showFloatingLabel ? (
              <Text style={styles.floatingLabel}>{modeLabel}</Text>
            ) : null}
            {showNegativePrefix ? (
              <Text style={styles.negativePrefix}>−</Text>
            ) : null}
            <TextInput
              accessibilityLabel={label}
              keyboardType="decimal-pad"
              onBlur={() => {
                setFocused(false);
                onBlur();
              }}
              onChangeText={onChangeText}
              onFocus={() => {
                setFocused(true);
                onFocus();
              }}
              placeholder={showFloatingLabel ? undefined : modeLabel}
              placeholderTextColor={colors2024['neutral-info']}
              style={[
                styles.input,
                showFloatingLabel ? styles.inputWithLabel : null,
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
            <Text numberOfLines={1} style={styles.modeText}>
              {modeLabel}
            </Text>
            <Text style={styles.caret}>⌄</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  },
);

PerpsProTpSlInput.displayName = 'PerpsProTpSlInput';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: { flex: 1, gap: 3, minWidth: 0 },
  legLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 10,
    lineHeight: 13,
  },
  field: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    height: 40,
    overflow: 'hidden',
  },
  fieldError: { borderColor: colors2024['red-default'] },
  inputArea: { flex: 1, height: '100%', minWidth: 0, position: 'relative' },
  floatingLabel: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 9,
    left: 6,
    lineHeight: 11,
    position: 'absolute',
    right: 2,
    top: 4,
  },
  input: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    fontWeight: '500',
    height: 38,
    lineHeight: 17,
    padding: 0,
    paddingHorizontal: 6,
  },
  inputWithLabel: { paddingTop: 11 },
  inputWithNegativePrefix: { paddingLeft: 15 },
  negativePrefix: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    left: 6,
    lineHeight: 17,
    position: 'absolute',
    top: 17,
  },
  mode: {
    alignItems: 'center',
    borderLeftColor: colors2024['neutral-line'],
    borderLeftWidth: 1,
    flexDirection: 'row',
    gap: 2,
    height: 24,
    paddingHorizontal: 5,
  },
  modeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 13,
  },
  caret: {
    color: colors2024['neutral-secondary'],
    fontSize: 9,
    lineHeight: 12,
  },
  error: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 9,
    lineHeight: 12,
  },
}));
