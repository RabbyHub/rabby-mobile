import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

export const PerpsProTradePriceField: React.FC<{
  editable?: boolean;
  label: string;
  onChangeText: (value: string) => void;
  onPressSuffix?: () => void;
  onPressValue?: () => void;
  suffix?: string;
  suffixActive?: boolean;
  value: string;
}> = React.memo(
  ({
    editable = true,
    label,
    onChangeText,
    onPressSuffix,
    onPressValue,
    suffix,
    suffixActive = false,
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const [focused, setFocused] = useState(false);
    const showFloatingLabel = focused || !!value;
    return (
      <View style={styles.container} testID="perps-pro-trade-price-field">
        <Pressable
          accessibilityRole={onPressValue ? 'button' : undefined}
          onPress={onPressValue}
          style={styles.fieldArea}>
          <View style={styles.inputArea}>
            {showFloatingLabel ? (
              <Text style={styles.label}>{label}</Text>
            ) : null}
            <TextInput
              accessibilityLabel={label}
              editable={editable}
              keyboardType="decimal-pad"
              maxFontSizeMultiplier={1.2}
              multiline={false}
              onBlur={() => setFocused(false)}
              onChangeText={onChangeText}
              onFocus={() => setFocused(true)}
              pointerEvents={onPressValue ? 'none' : 'auto'}
              placeholder={showFloatingLabel ? undefined : label}
              placeholderTextColor={colors2024['neutral-info']}
              style={[
                styles.input,
                !showFloatingLabel && !value ? styles.placeholderInput : null,
                showFloatingLabel ? styles.inputWithLabel : null,
              ]}
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
              suffixActive ? styles.suffixActive : null,
              !onPressSuffix ? styles.disabledSuffix : null,
            ]}
            testID={`perps-pro-trade-price-suffix-${suffix}`}>
            <Text numberOfLines={1} style={styles.suffix}>
              {suffix}
            </Text>
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
    lineHeight: 18,
    padding: 0,
    textAlign: 'center',
  },
  inputWithLabel: {
    paddingTop: 12,
  },
  placeholderInput: { fontSize: 12 },
  suffixArea: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
    width: 60,
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
}));
