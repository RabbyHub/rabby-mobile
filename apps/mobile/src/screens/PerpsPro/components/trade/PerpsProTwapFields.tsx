import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { PerpsProTradeController } from '../../scene/usePerpsProTrade';
import { PERPS_PRO_TWAP_DURATION_PRESETS } from '../../model/twapOrder';

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
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const value = controller.form.twapDuration;
    const totalMinutes = Number(value);
    const hours = Math.floor(totalMinutes / 60);
    const label = t('page.perps.pro.twap.durationFieldLabel');
    const displayValue = value
      ? t('page.perps.pro.twap.durationFieldValue', {
          hours: t(hours === 1 ? 'global.time.hour' : 'global.time.hours', {
            t: hours,
          }),
          minutes: totalMinutes % 60,
        })
      : '';
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={displayValue ? { text: displayValue } : undefined}
          onPress={onSelectTime}
          style={styles.field}>
          {value ? (
            <>
              <Text style={styles.label} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.value} numberOfLines={1}>
                {displayValue}
              </Text>
            </>
          ) : (
            <Text style={styles.placeholder} numberOfLines={1}>
              {label}
            </Text>
          )}
        </Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 2,
  },
  label: {
    fontFamily: 'SF Pro',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
    color: colors2024['neutral-secondary'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    color: colors2024['neutral-title-1'],
  },
  placeholder: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    color: colors2024['neutral-info'],
  },
  presets: { flexDirection: 'row', gap: 4 },
  preset: {
    flex: 1,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024[isLight ? 'neutral-bg-0' : 'neutral-bg-5'],
  },
  presetText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    color: colors2024['neutral-title-1'],
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
