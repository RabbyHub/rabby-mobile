import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import {
  PERPS_PRO_TWAP_DURATION_PRESETS,
  sanitizePerpsProTwapDuration,
} from '../../model/twapOrder';
import { usePerpsProKeyboardInput } from '../common/usePerpsProKeyboardInput';
import { PerpsProInputAccessory } from '../common/PerpsProInputAccessory';
import { PERPS_PRO_INPUT_COLOR_PROPS } from '../common/perpsProInputVisual';
import { PerpsProSelectCaret } from '../common/PerpsProSelectCaret';

export const PerpsProTwapHint = ({ children }: { children: string }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View accessibilityRole="alert" style={styles.hint}>
      <View style={styles.arrow} />
      <Text style={styles.hintText}>{children}</Text>
    </View>
  );
};

export const PerpsProTwapFields = React.memo(
  ({
    controller,
    onSelectTime,
  }: {
    controller: PerpsProTradeController;
    onSelectTime: () => void;
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const input = useRef<TextInput>(null);
    const keyboard = usePerpsProKeyboardInput(input, { scrollTrade: true });
    const [focused, setFocused] = useState(false);
    const value = controller.form.twapDuration;
    const error = controller.getTwapValidation('buy').durationError;
    return (
      <>
        <View style={[styles.field, !!value && !!error && styles.invalid]}>
          <View style={styles.inputArea}>
            {focused || value ? (
              <Text style={styles.label}>
                {t('page.perps.pro.twap.totalTime')}
              </Text>
            ) : null}
            <TextInput
              {...PERPS_PRO_INPUT_COLOR_PROPS}
              ref={input}
              inputMode="numeric"
              keyboardType="number-pad"
              allowFontScaling={false}
              inputAccessoryViewID={keyboard.inputAccessoryViewID}
              accessibilityLabel={t('page.perps.pro.twap.totalTime')}
              placeholder={focused ? '' : t('page.perps.pro.twap.totalTime')}
              placeholderTextColor={colors2024['neutral-info']}
              value={value}
              style={[
                styles.input,
                (focused || !!value) && styles.floatingInput,
              ]}
              onFocus={() => {
                setFocused(true);
                keyboard.onFocus();
              }}
              onBlur={() => {
                setFocused(false);
                keyboard.onBlur();
              }}
              onChangeText={raw => {
                const next = sanitizePerpsProTwapDuration(raw, value);
                if (raw !== next) input.current?.setNativeProps({ text: next });
                controller.patchForm({ twapDuration: next });
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('page.perps.pro.twap.selectTime')}
            style={styles.unit}
            onPress={onSelectTime}>
            <Text style={styles.unitText}>min</Text>
            <PerpsProSelectCaret color={colors2024['neutral-secondary']} />
          </Pressable>
        </View>
        {focused || (!!value && !!error) ? (
          <PerpsProTwapHint>
            {t(
              error && value
                ? `page.perps.pro.twap.errors.${error}`
                : 'page.perps.pro.twap.durationHint',
            )}
          </PerpsProTwapHint>
        ) : null}
        <View style={styles.presets}>
          {PERPS_PRO_TWAP_DURATION_PRESETS.map(minutes => (
            <Pressable
              key={minutes}
              accessibilityRole="button"
              onPress={() =>
                controller.patchForm({ twapDuration: String(minutes) })
              }
              style={({ pressed }) => [
                styles.preset,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.presetText}>
                {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
              </Text>
            </Pressable>
          ))}
        </View>
        <PerpsProInputAccessory nativeID={keyboard.inputAccessoryViewID} />
      </>
    );
  },
);
PerpsProTwapFields.displayName = 'PerpsProTwapFields';
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  field: {
    height: 42,
    borderRadius: 6,
    backgroundColor: colors2024[isLight ? 'neutral-bg-0' : 'neutral-bg-5'],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  invalid: { borderWidth: 1, borderColor: colors2024['red-default'] },
  inputArea: { flex: 1, height: '100%', minWidth: 0 },
  label: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 12,
    color: colors2024['neutral-info'],
  },
  input: {
    height: 42,
    padding: 0,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    includeFontPadding: false,
  },
  floatingInput: { paddingTop: 12 },
  unit: {
    height: 26,
    borderLeftWidth: 1,
    borderLeftColor: colors2024['neutral-line'],
    paddingLeft: 10,
    paddingRight: 4,
    minWidth: 63,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  presets: { flexDirection: 'row', gap: 4 },
  preset: {
    flex: 1,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024[isLight ? 'neutral-bg-0' : 'neutral-bg-5'],
  },
  presetText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-secondary'],
  },
  pressed: { opacity: 0.6 },
  hint: {
    alignSelf: 'stretch',
    backgroundColor: '#192945',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    position: 'relative',
  },
  hintText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  arrow: {
    position: 'absolute',
    top: -5,
    left: '50%',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#192945',
  },
}));
